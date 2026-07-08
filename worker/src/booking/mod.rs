//! Booking lifecycle: maps WorkerEvents from the marketplace WS into
//! sandbox + inference operations on this host.
//!
//! # Booking flow
//!
//! 1. Marketplace transitions a booking from `pending` → `active`.
//! 2. Marketplace publishes `BookingActivated` on the worker's WS.
//! 3. `BookingHandler::dispatch` is called with the event.
//! 4. `ModelHost::ensure_loaded` swaps mlx-lm to the requested model
//!    (idempotent — no-op if already loaded).
//! 5. `SandboxBackend::start` boots a microVM running `claw/agent-base:0.1`.
//! 6. The agent runtime in the sandbox connects to mlx-lm at
//!    `host.containers.internal:9000` for inference.
//! 7. Worker persists the booking row to SQLite for crash recovery.
//!
//! For each consumer chat message (`MessageUser` event):
//!
//! 1. Worker looks up the sandbox port stored at activation time.
//! 2. POSTs the message to `127.0.0.1:<port>/v1/chat/completions`.
//! 3. Posts the assistant reply back via the marketplace's worker-only
//!    `/v1/bookings/{id}/messages/internal` endpoint.
//!
//! On `BookingCancelled`, steps 4-6 reverse: backend stops the sandbox,
//! state row is marked cancelled, sandbox port forgotten. ModelHost is
//! left running because the next booking will likely need it.
//!
//! # Construction
//!
//! ```no_run
//! use std::sync::Arc;
//! use claw_worker::api::client::ApiClient;
//! use claw_worker::booking::BookingHandler;
//! use claw_worker::inference::ModelHost;
//! use claw_worker::sandbox::registry;
//! use claw_worker::state::State;
//! use tokio::sync::Mutex;
//!
//! # async fn example(api_url: &str, worker_token: String) -> anyhow::Result<()> {
//! let backend = registry::auto();
//! let state = Arc::new(Mutex::new(State::open(std::path::Path::new("state.db"))?));
//! let model_host = Arc::new(ModelHost::new());
//! let api = Arc::new(ApiClient::new(api_url)?);
//! let handler = BookingHandler::new(backend, state)
//!     .with_model_host(model_host)
//!     .with_api_client(api, worker_token);
//! # Ok(())
//! # }
//! ```
use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;

use crate::api::client::ApiClient;
use crate::api::ws::WorkerEvent;
use crate::inference::ModelHost;
use crate::sandbox::{SandboxBackend, SandboxSpec};
use crate::state::{BookingRow, State};

pub const MODEL_HOST_PORT: u16 = 9000;

pub struct BookingHandler {
    backend: Arc<dyn SandboxBackend>,
    state: Arc<tokio::sync::Mutex<State>>,
    model_host: Option<Arc<ModelHost>>,
    api: Option<Arc<ApiClient>>,
    worker_token: Option<String>,
    sandbox_ports: Arc<tokio::sync::Mutex<HashMap<String, u16>>>,
}

impl BookingHandler {
    pub fn new(backend: Arc<dyn SandboxBackend>, state: Arc<tokio::sync::Mutex<State>>) -> Self {
        Self {
            backend,
            state,
            model_host: None,
            api: None,
            worker_token: None,
            sandbox_ports: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
        }
    }

    /// Builder: attach a ModelHost so BookingActivated events ensure mlx-lm
    /// is serving the requested model before launching the sandbox.
    pub fn with_model_host(mut self, model_host: Arc<ModelHost>) -> Self {
        self.model_host = Some(model_host);
        self
    }

    /// Builder: attach the marketplace ApiClient + worker JWT so MessageUser
    /// events can be relayed to the sandbox and assistant replies posted back.
    pub fn with_api_client(mut self, api: Arc<ApiClient>, worker_token: String) -> Self {
        self.api = Some(api);
        self.worker_token = Some(worker_token);
        self
    }

    pub async fn dispatch(&self, ev: WorkerEvent) -> Result<()> {
        match ev {
            WorkerEvent::Ping => Ok(()),
            WorkerEvent::BookingActivated {
                booking_id,
                offering_id,
                agent_config,
            } => {
                if let Some(host) = &self.model_host {
                    let model_id = agent_config
                        .get("model_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("qwen");
                    if let Err(e) = host.ensure_loaded(model_id, MODEL_HOST_PORT).await {
                        tracing::warn!(
                            error = ?e,
                            model_id,
                            "failed to ensure model loaded; sandbox will start anyway"
                        );
                    }
                }
                let spec = SandboxSpec {
                    booking_id: booking_id.clone(),
                    offering_id: offering_id.clone(),
                    image: "claw/agent-base:0.1".into(),
                    cpu_limit: None,
                    memory_limit_mb: None,
                    agent_config,
                };
                let handle = self.backend.start(spec).await?;
                if let Some(port) = handle.forwarded_port {
                    self.sandbox_ports
                        .lock()
                        .await
                        .insert(booking_id.clone(), port);
                }
                let st = self.state.lock().await;
                st.upsert_booking(&BookingRow {
                    id: booking_id,
                    offering_id,
                    status: "active".into(),
                    started_at: Some(chrono::Utc::now()),
                    sandbox_id: Some(handle.sandbox_id),
                })?;
                Ok(())
            }
            WorkerEvent::BookingCancelled { booking_id } => {
                let st = self.state.lock().await;
                let active = st.list_active_bookings()?;
                if let Some(row) = active.iter().find(|r| r.id == booking_id) {
                    if let Some(sb) = &row.sandbox_id {
                        self.backend.stop(sb).await?;
                    }
                    st.upsert_booking(&BookingRow {
                        id: row.id.clone(),
                        offering_id: row.offering_id.clone(),
                        status: "cancelled".into(),
                        started_at: row.started_at,
                        sandbox_id: row.sandbox_id.clone(),
                    })?;
                }
                drop(st);
                self.sandbox_ports.lock().await.remove(&booking_id);
                Ok(())
            }
            WorkerEvent::MessageUser {
                booking_id,
                content,
            } => self.relay_message(&booking_id, &content).await,
            // The WS layer opens Sealed envelopes before dispatch, so we
            // should never see one here. Treat as a bug and drop silently.
            WorkerEvent::Sealed(_) => {
                tracing::warn!("dispatch: unexpected sealed event reached handler");
                Ok(())
            }
        }
    }

    async fn relay_message(&self, booking_id: &str, content: &str) -> Result<()> {
        let port = self.sandbox_ports.lock().await.get(booking_id).copied();
        let api = self.api.as_ref();
        let token = self.worker_token.as_ref();

        let (Some(port), Some(api), Some(token)) = (port, api, token) else {
            tracing::info!(
                %booking_id,
                content_preview = %&content.chars().take(60).collect::<String>(),
                has_port = port.is_some(),
                has_api = api.is_some(),
                "received user message but no sandbox/API wiring; logging only"
            );
            return Ok(());
        };

        match api.sandbox_chat(port, content).await {
            Ok(reply) => {
                if let Err(e) = api.post_assistant_message(token, booking_id, &reply).await {
                    tracing::warn!(error = ?e, %booking_id, "failed to post assistant reply");
                }
            }
            Err(e) => {
                tracing::warn!(error = ?e, %booking_id, "sandbox chat call failed");
                let _ = api
                    .post_assistant_message(token, booking_id, &format!("(agent error: {e})"))
                    .await;
            }
        }
        Ok(())
    }
}
