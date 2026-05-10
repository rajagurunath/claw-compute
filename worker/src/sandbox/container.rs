use std::path::PathBuf;

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use tokio::process::Command;

use super::{SandboxBackend, SandboxHandle, SandboxSpec};

pub struct ContainerBackend {
    binary: PathBuf,
}

impl ContainerBackend {
    /// Returns Err if Apple `container` is not on PATH.
    pub fn detect() -> Result<Self> {
        let binary =
            which::which("container").context("apple `container` CLI not found on PATH")?;
        Ok(Self { binary })
    }

    fn build_run_args(spec: &SandboxSpec, config_path: &str) -> Vec<String> {
        let mut args = vec![
            "run".into(),
            "-d".into(),
            "--name".into(),
            sandbox_name(&spec.booking_id),
            "--mount".into(),
            format!("type=bind,source={config_path},target=/etc/claw.json,readonly"),
        ];
        if let Some(cpu) = spec.cpu_limit {
            args.extend(["--cpus".into(), cpu.to_string()]);
        }
        if let Some(mem) = spec.memory_limit_mb {
            args.extend(["--memory".into(), format!("{mem}m")]);
        }
        args.push(spec.image.clone());
        args
    }
}

pub fn sandbox_name(booking_id: &str) -> String {
    format!("claw-{}", booking_id.replace('-', ""))
}

#[async_trait]
impl SandboxBackend for ContainerBackend {
    fn name(&self) -> &'static str {
        "container"
    }

    async fn start(&self, spec: SandboxSpec) -> Result<SandboxHandle> {
        let dir = tempfile::tempdir()?;
        let cfg_path = dir.path().join("claw.json");
        std::fs::write(
            &cfg_path,
            serde_json::to_vec(&serde_json::json!({
                "booking_id": spec.booking_id,
                "offering_id": spec.offering_id,
                "model_id": "qwen",
                "agent_config": spec.agent_config,
            }))?,
        )?;
        let args = Self::build_run_args(&spec, cfg_path.to_string_lossy().as_ref());
        let out = Command::new(&self.binary).args(&args).output().await?;
        if !out.status.success() {
            return Err(anyhow!(
                "container run failed: {}",
                String::from_utf8_lossy(&out.stderr)
            ));
        }
        let id = String::from_utf8(out.stdout)?.trim().to_string();
        // Leak the tempdir so the bind mount survives container lifetime;
        // the host-side claw.json is small (<1KB) and OS cleans on reboot.
        std::mem::forget(dir);
        Ok(SandboxHandle {
            sandbox_id: id,
            forwarded_port: Some(8080),
        })
    }

    async fn stop(&self, sandbox_id: &str) -> Result<()> {
        let stop = Command::new(&self.binary)
            .args(["stop", sandbox_id])
            .output()
            .await?;
        if !stop.status.success() {
            tracing::warn!(stderr = %String::from_utf8_lossy(&stop.stderr), "container stop");
        }
        let _ = Command::new(&self.binary)
            .args(["rm", sandbox_id])
            .output()
            .await?;
        Ok(())
    }

    async fn is_running(&self, sandbox_id: &str) -> Result<bool> {
        let out = Command::new(&self.binary)
            .args(["inspect", "--format", "{{.State.Status}}", sandbox_id])
            .output()
            .await?;
        Ok(String::from_utf8_lossy(&out.stdout).trim() == "running")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sandbox::SandboxSpec;

    #[test]
    fn run_args_include_image_and_config_mount() {
        let spec = SandboxSpec {
            booking_id: "b1".into(),
            offering_id: "o1".into(),
            image: "claw/agent-base:0.1".into(),
            cpu_limit: Some(2),
            memory_limit_mb: Some(4096),
            agent_config: serde_json::Value::Null,
        };
        let args = ContainerBackend::build_run_args(&spec, "/tmp/c.json");
        assert!(args.contains(&"claw/agent-base:0.1".to_string()));
        assert!(args.iter().any(|a| a.contains("/tmp/c.json")));
        assert!(args.contains(&"2".to_string()));
        assert!(args.contains(&"4096m".to_string()));
    }

    #[test]
    fn run_args_omit_limits_when_unset() {
        let spec = SandboxSpec {
            booking_id: "b2".into(),
            offering_id: "o2".into(),
            image: "claw/agent-base:latest".into(),
            cpu_limit: None,
            memory_limit_mb: None,
            agent_config: serde_json::Value::Null,
        };
        let args = ContainerBackend::build_run_args(&spec, "/tmp/c.json");
        assert!(!args.iter().any(|a| a == "--cpus"));
        assert!(!args.iter().any(|a| a == "--memory"));
    }

    #[test]
    fn sandbox_name_strips_dashes() {
        assert_eq!(sandbox_name("ab-cd-ef"), "claw-abcdef");
    }
}
