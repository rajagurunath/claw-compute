use std::path::PathBuf;

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use tokio::process::Command;

use super::{SandboxBackend, SandboxHandle, SandboxSpec};

const VM_NAME: &str = "claw-sandbox-host";

pub struct LimaBackend {
    limactl: PathBuf,
}

impl LimaBackend {
    pub fn detect() -> Result<Self> {
        let limactl = which::which("limactl").context("limactl not found on PATH")?;
        Ok(Self { limactl })
    }

    async fn ensure_vm(&self) -> Result<()> {
        let out = Command::new(&self.limactl)
            .args(["list", "-q"])
            .output()
            .await?;
        let names = String::from_utf8_lossy(&out.stdout);
        if names.lines().any(|l| l.trim() == VM_NAME) {
            // Start if stopped (idempotent — already-running is also fine).
            let _ = Command::new(&self.limactl)
                .args(["start", VM_NAME])
                .output()
                .await?;
            return Ok(());
        }
        let create = Command::new(&self.limactl)
            .args([
                "create",
                "--name",
                VM_NAME,
                "--tty=false",
                "template://docker",
            ])
            .output()
            .await?;
        if !create.status.success() {
            return Err(anyhow!(
                "limactl create failed: {}",
                String::from_utf8_lossy(&create.stderr)
            ));
        }
        let start = Command::new(&self.limactl)
            .args(["start", VM_NAME])
            .output()
            .await?;
        if !start.status.success() {
            return Err(anyhow!(
                "limactl start failed: {}",
                String::from_utf8_lossy(&start.stderr)
            ));
        }
        Ok(())
    }

    async fn docker(&self, args: &[&str]) -> Result<std::process::Output> {
        let out = Command::new(&self.limactl)
            .args(["shell", VM_NAME, "docker"])
            .args(args)
            .output()
            .await?;
        Ok(out)
    }
}

pub fn lima_sandbox_name(booking_id: &str) -> String {
    format!("claw-{}", booking_id.replace('-', ""))
}

fn shell_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('\'');
    for c in s.chars() {
        if c == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(c);
        }
    }
    out.push('\'');
    out
}

#[async_trait]
impl SandboxBackend for LimaBackend {
    fn name(&self) -> &'static str {
        "lima"
    }

    async fn start(&self, spec: SandboxSpec) -> Result<SandboxHandle> {
        self.ensure_vm().await?;
        let name = lima_sandbox_name(&spec.booking_id);
        let cfg = serde_json::json!({
            "booking_id": spec.booking_id,
            "offering_id": spec.offering_id,
            "model_id": "qwen",
            "agent_config": spec.agent_config,
        });
        let cfg_path = format!("/tmp/{name}.json");
        let write_cmd = format!(
            "echo {} > {cfg_path}",
            shell_escape(&serde_json::to_string(&cfg)?)
        );
        Command::new(&self.limactl)
            .args(["shell", VM_NAME, "sh", "-c"])
            .arg(write_cmd)
            .output()
            .await?;
        let mount = format!("{cfg_path}:/etc/claw.json:ro");
        let out = self
            .docker(&["run", "-d", "--name", &name, "-v", &mount, &spec.image])
            .await?;
        if !out.status.success() {
            return Err(anyhow!(
                "lima docker run failed: {}",
                String::from_utf8_lossy(&out.stderr)
            ));
        }
        Ok(SandboxHandle {
            sandbox_id: name,
            forwarded_port: Some(8080),
        })
    }

    async fn stop(&self, sandbox_id: &str) -> Result<()> {
        let _ = self.docker(&["stop", sandbox_id]).await?;
        let _ = self.docker(&["rm", sandbox_id]).await?;
        Ok(())
    }

    async fn is_running(&self, sandbox_id: &str) -> Result<bool> {
        let out = self
            .docker(&["inspect", "--format", "{{.State.Status}}", sandbox_id])
            .await?;
        Ok(String::from_utf8_lossy(&out.stdout).trim() == "running")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_escape_basic() {
        assert_eq!(shell_escape("hello"), "'hello'");
    }

    #[test]
    fn shell_escape_quote_inside() {
        assert_eq!(shell_escape("it's"), "'it'\\''s'");
    }

    #[test]
    fn lima_sandbox_name_strips_dashes() {
        assert_eq!(lima_sandbox_name("ab-cd-ef"), "claw-abcdef");
    }
}
