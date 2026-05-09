use std::sync::atomic::{AtomicU64, Ordering};

use anyhow::Result;
use async_trait::async_trait;

use super::{SandboxBackend, SandboxHandle, SandboxSpec};

pub struct NoopBackend {
    counter: AtomicU64,
}

impl NoopBackend {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }
}

impl Default for NoopBackend {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SandboxBackend for NoopBackend {
    fn name(&self) -> &'static str {
        "noop"
    }

    async fn start(&self, spec: SandboxSpec) -> Result<SandboxHandle> {
        let n = self.counter.fetch_add(1, Ordering::Relaxed);
        let id = format!("noop-{n}");
        tracing::info!(sandbox_id = %id, booking = %spec.booking_id, "noop start");
        Ok(SandboxHandle {
            sandbox_id: id,
            forwarded_port: None,
        })
    }

    async fn stop(&self, sandbox_id: &str) -> Result<()> {
        tracing::info!(%sandbox_id, "noop stop");
        Ok(())
    }

    async fn is_running(&self, _sandbox_id: &str) -> Result<bool> {
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn start_returns_unique_ids() {
        let b = NoopBackend::new();
        let spec = SandboxSpec {
            booking_id: "b1".into(),
            offering_id: "o1".into(),
            image: "i".into(),
            cpu_limit: None,
            memory_limit_mb: None,
            agent_config: serde_json::Value::Null,
        };
        let a = b.start(spec.clone()).await.unwrap();
        let c = b.start(spec).await.unwrap();
        assert_ne!(a.sandbox_id, c.sandbox_id);
    }

    #[tokio::test]
    async fn stop_succeeds_for_unknown_id() {
        NoopBackend::new().stop("nonexistent").await.unwrap();
    }
}
