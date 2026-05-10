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
//! On `BookingCancelled`, steps 4-6 reverse: backend stops the sandbox,
//! state row is marked cancelled. ModelHost is left running because the
//! next booking will likely need it (avoids cold-start churn).
//!
//! # Construction
//!
//! ```no_run
//! use std::sync::Arc;
//! use claw_worker::booking::BookingHandler;
//! use claw_worker::inference::ModelHost;
//! use claw_worker::sandbox::registry;
//! use claw_worker::state::State;
//! use tokio::sync::Mutex;
//!
//! # async fn example() -> anyhow::Result<()> {
//! let backend = registry::auto();
//! let state = Arc::new(Mutex::new(State::open(std::path::Path::new("state.db"))?));
//! let model_host = Arc::new(ModelHost::new());
//! let handler = BookingHandler::new(backend, state).with_model_host(model_host);
//! # Ok(())
//! # }
//! ```
use std::sync::Arc;

use anyhow::Result;

use crate::api::ws::WorkerEvent;
use crate::inference::ModelHost;
use crate::sandbox::{SandboxBackend, SandboxSpec};
use crate::state::{BookingRow, State};

pub const MODEL_HOST_PORT: u16 = 9000;

pub struct BookingHandler {
    backend: Arc<dyn SandboxBackend>,
    state: Arc<tokio::sync::Mutex<State>>,
    model_host: Option<Arc<ModelHost>>,
}

impl BookingHandler {
    pub fn new(
        backend: Arc<dyn SandboxBackend>,
        state: Arc<tokio::sync::Mutex<State>>,
    ) -> Self {
        Self {
            backend,
            state,
            model_host: None,
        }
    }

    /// Builder: attach a ModelHost so BookingActivated events ensure mlx-lm
    /// is serving the requested model before launching the sandbox.
    pub fn with_model_host(mut self, model_host: Arc<ModelHost>) -> Self {
        self.model_host = Some(model_host);
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
                Ok(())
            }
            WorkerEvent::MessageUser {
                booking_id,
                content,
            } => {
                tracing::info!(
                    %booking_id,
                    content_preview = %&content.chars().take(60).collect::<String>(),
                    "received user message (Plan 3 will forward to sandbox)"
                );
                Ok(())
            }
        }
    }
}
