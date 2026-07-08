use std::sync::Arc;

use super::{SandboxBackend, container::ContainerBackend, lima::LimaBackend, noop::NoopBackend};

pub fn pick_backend(name: &str) -> Arc<dyn SandboxBackend> {
    match name {
        "container" => match ContainerBackend::detect() {
            Ok(b) => Arc::new(b),
            Err(e) => {
                tracing::warn!(error = ?e, "container backend unavailable; using noop");
                Arc::new(NoopBackend::new())
            }
        },
        "lima" => match LimaBackend::detect() {
            Ok(b) => Arc::new(b),
            Err(e) => {
                tracing::warn!(error = ?e, "lima backend unavailable; using noop");
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

/// Pick the best available backend for this host:
/// - Apple `container` if installed (macOS 26+)
/// - Lima fallback if `limactl` is on PATH (macOS 14/15)
/// - Otherwise NoopBackend (logs only — useful for tests / dev)
pub fn auto() -> Arc<dyn SandboxBackend> {
    if which::which("container").is_ok() {
        return pick_backend("container");
    }
    if which::which("limactl").is_ok() {
        return pick_backend("lima");
    }
    Arc::new(NoopBackend::new())
}
