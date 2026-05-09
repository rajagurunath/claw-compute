use std::sync::Arc;

use super::{SandboxBackend, noop::NoopBackend};

pub fn pick_backend(name: &str) -> Arc<dyn SandboxBackend> {
    match name {
        "noop" => Arc::new(NoopBackend::new()),
        // Plan 3 will register "container" and "lima" here.
        other => {
            tracing::warn!(requested = %other, "unknown backend; falling back to noop");
            Arc::new(NoopBackend::new())
        }
    }
}
