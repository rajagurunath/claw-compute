use std::sync::Arc;

use super::{SandboxBackend, container::ContainerBackend, noop::NoopBackend};

pub fn pick_backend(name: &str) -> Arc<dyn SandboxBackend> {
    match name {
        "container" => match ContainerBackend::detect() {
            Ok(b) => Arc::new(b),
            Err(e) => {
                tracing::warn!(error = ?e, "container backend unavailable; using noop");
                Arc::new(NoopBackend::new())
            }
        },
        "noop" => Arc::new(NoopBackend::new()),
        other => {
            tracing::warn!(requested = %other, "unknown backend; falling back to noop");
            Arc::new(NoopBackend::new())
        }
    }
}
