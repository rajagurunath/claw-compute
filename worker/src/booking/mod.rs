/// # Booking flow
///
/// 1. Marketplace transitions a booking from `pending` → `active`.
/// 2. Marketplace publishes `BookingActivated` on the worker's WS.
/// 3. `BookingHandler::dispatch` is called with the event.
/// 4. `SandboxBackend::start` boots a microVM running `claw/agent-base:0.1`.
/// 5. The agent runtime in the sandbox connects to mlx-lm at
///    `host.containers.internal:9000` for inference (Plan 3).
/// 6. Worker persists the booking row to SQLite for crash recovery.
///
/// On `BookingCancelled`, steps 4-5 reverse: backend stops the sandbox, state
/// row marked cancelled.
use std::sync::Arc;

use anyhow::Result;

use crate::api::ws::WorkerEvent;
use crate::sandbox::{SandboxBackend, SandboxSpec};
use crate::state::{BookingRow, State};

pub struct BookingHandler {
    backend: Arc<dyn SandboxBackend>,
    state: Arc<tokio::sync::Mutex<State>>,
}

impl BookingHandler {
    pub fn new(
        backend: Arc<dyn SandboxBackend>,
        state: Arc<tokio::sync::Mutex<State>>,
    ) -> Self {
        Self { backend, state }
    }

    pub async fn dispatch(&self, ev: WorkerEvent) -> Result<()> {
        match ev {
            WorkerEvent::Ping => Ok(()),
            WorkerEvent::BookingActivated {
                booking_id,
                offering_id,
                agent_config,
            } => {
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
                // v1: log the message; the sandbox forwarding + assistant reply
                // round-trip is implemented in Plan 3 (sandbox HTTP) once the
                // sandbox runtime can be reached.
                tracing::info!(%booking_id, content_preview = %&content.chars().take(60).collect::<String>(), "received user message (Plan 3 will forward to sandbox)");
                Ok(())
            }
        }
    }
}
