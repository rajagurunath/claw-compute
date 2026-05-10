pub mod models;

use std::process::Stdio;
use std::sync::Arc;

use anyhow::{Context, Result, anyhow};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use models::{ModelEntry, lookup};

pub struct ModelHost {
    inner: Arc<Mutex<HostState>>,
}

struct HostState {
    current: Option<Running>,
}

struct Running {
    model: &'static ModelEntry,
    child: Child,
    port: u16,
}

impl ModelHost {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HostState { current: None })),
        }
    }

    /// Ensures `model_id` is loaded and serving on `port`. Idempotent: if the
    /// requested model is already running on the requested port, returns
    /// without restarting. Otherwise stops the previous process (if any) and
    /// spawns a fresh `uv tool run mlx_lm.server`.
    pub async fn ensure_loaded(
        &self,
        model_id: &str,
        port: u16,
    ) -> Result<&'static ModelEntry> {
        let entry = lookup(model_id).ok_or_else(|| anyhow!("unknown model id: {model_id}"))?;
        let mut state = self.inner.lock().await;
        if let Some(r) = &state.current
            && r.model.id == entry.id
            && r.port == port
        {
            return Ok(entry);
        }
        if let Some(r) = &state.current {
            tracing::info!(switching_from = %r.model.id, to = %entry.id, "swapping model");
        }
        if let Some(mut r) = state.current.take() {
            let _ = r.child.kill().await;
        }
        tracing::info!(model = %entry.id, repo = %entry.hf_repo, port, "launching mlx-lm server");
        let uv = which::which("uv").context("`uv` not on PATH (run bootstrap-host-deps.sh)")?;
        let child = Command::new(&uv)
            .args([
                "tool",
                "run",
                "--from",
                "mlx-lm",
                "mlx_lm.server",
                "--model",
                entry.hf_repo,
                "--host",
                "127.0.0.1",
                "--port",
                &port.to_string(),
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .context("spawning mlx_lm.server")?;
        state.current = Some(Running {
            model: entry,
            child,
            port,
        });
        Ok(entry)
    }

    pub async fn stop(&self) -> Result<()> {
        let mut state = self.inner.lock().await;
        if let Some(mut r) = state.current.take() {
            let _ = r.child.kill().await;
        }
        Ok(())
    }
}

impl Default for ModelHost {
    fn default() -> Self {
        Self::new()
    }
}
