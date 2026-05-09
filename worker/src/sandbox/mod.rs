pub mod noop;
pub mod registry;

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SandboxSpec {
    pub booking_id: String,
    pub offering_id: String,
    /// Image reference understood by the backend (e.g. "claw/agent-base:0.1").
    pub image: String,
    /// Resource ceiling.
    pub cpu_limit: Option<u32>,
    pub memory_limit_mb: Option<u32>,
    /// Free-form configuration the sandboxed agent reads from /etc/claw.json.
    pub agent_config: serde_json::Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SandboxHandle {
    /// Backend-issued identifier so we can stop it later.
    pub sandbox_id: String,
    pub forwarded_port: Option<u16>,
}

#[async_trait]
pub trait SandboxBackend: Send + Sync {
    fn name(&self) -> &'static str;
    async fn start(&self, spec: SandboxSpec) -> Result<SandboxHandle>;
    async fn stop(&self, sandbox_id: &str) -> Result<()>;
    async fn is_running(&self, sandbox_id: &str) -> Result<bool>;
}
