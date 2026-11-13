use std::path::PathBuf;

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use tokio::process::Command;

use super::{SandboxBackend, SandboxHandle, SandboxSpec};

pub struct DockerBackend {
    binary: PathBuf,
}

impl DockerBackend {
    pub fn detect() -> Result<Self> {
        let binary = which::which("docker").context("`docker` CLI not found on PATH")?;
        Ok(Self { binary })
    }

    pub fn is_available(&self) -> bool {
        std::process::Command::new(&self.binary)
            .args(["info", "--format", "{{.ServerVersion}}"])
            .output()
            .is_ok_and(|out| out.status.success())
    }

    fn build_run_args(spec: &SandboxSpec, config_path: &str) -> Vec<String> {
        let mut args = vec![
            "run".into(),
            "-d".into(),
            "--name".into(),
            sandbox_name(&spec.booking_id),
            "-p".into(),
            "127.0.0.1::8080".into(),
            "--mount".into(),
            format!("type=bind,source={config_path},target=/etc/claw.json,readonly"),
        ];
        // Hermes: a named volume that outlives the container, so the agent's
        // /claw/state (memory, scratch) persists across bookings.
        if let Some(volume) = &spec.persist_volume {
            args.push("-v".into());
            args.push(format!("{volume}:/claw/state"));
        }
        if let Some(cpu) = spec.cpu_limit {
            args.extend(["--cpus".into(), cpu.to_string()]);
        }
        if let Some(mem) = spec.memory_limit_mb {
            args.extend(["--memory".into(), format!("{mem}m")]);
        }
        args.push(spec.image.clone());
        args
    }

    async fn forwarded_port(&self, container_id: &str) -> Result<u16> {
        let out = Command::new(&self.binary)
            .args(["port", container_id, "8080/tcp"])
            .output()
            .await?;
        if !out.status.success() {
            return Err(anyhow!(
                "docker port failed: {}",
                String::from_utf8_lossy(&out.stderr)
            ));
        }
        parse_forwarded_port(&String::from_utf8_lossy(&out.stdout))
    }
}

pub fn sandbox_name(booking_id: &str) -> String {
    format!("claw-{}", booking_id.replace('-', ""))
}

fn parse_forwarded_port(output: &str) -> Result<u16> {
    output
        .lines()
        .find_map(|line| {
            line.rsplit_once(':')
                .and_then(|(_, port)| port.parse().ok())
        })
        .ok_or_else(|| anyhow!("docker did not publish sandbox port: {output}"))
}

#[async_trait]
impl SandboxBackend for DockerBackend {
    fn name(&self) -> &'static str {
        "docker"
    }

    async fn start(&self, spec: SandboxSpec) -> Result<SandboxHandle> {
        let dir = tempfile::tempdir()?;
        let cfg_path = dir.path().join("claw.json");
        // Inference endpoint the supplier hosts. Defaults to local mlx-lm, but
        // can point at any OpenAI-compatible endpoint (e.g. an io.net GLM) via
        // CLAW_INFERENCE_BASE_URL / _API_KEY / CLAW_MODEL. The API key stays on
        // the supplier's host — written into the container, never logged.
        let inference_base_url = std::env::var("CLAW_INFERENCE_BASE_URL")
            .unwrap_or_else(|_| "http://host.docker.internal:9000/v1".into());
        let inference_api_key = std::env::var("CLAW_INFERENCE_API_KEY").unwrap_or_default();
        let model_id = std::env::var("CLAW_MODEL").ok().map(serde_json::Value::from).or_else(
            || spec.agent_config.get("model_id").cloned(),
        ).unwrap_or_else(|| serde_json::json!("qwen"));
        std::fs::write(
            &cfg_path,
            serde_json::to_vec(&serde_json::json!({
                "booking_id": spec.booking_id,
                "offering_id": spec.offering_id,
                "model_id": model_id,
                "workload": spec.agent_config.get("workload").cloned()
                    .unwrap_or_else(|| serde_json::json!("sandbox")),
                "state_dir": spec.persist_volume.as_ref().map(|_| "/claw/state"),
                "inference_base_url": inference_base_url,
                "inference_api_key": inference_api_key,
                "agent_config": spec.agent_config,
            }))?,
        )?;
        let args = Self::build_run_args(&spec, cfg_path.to_string_lossy().as_ref());
        let out = Command::new(&self.binary).args(&args).output().await?;
        if !out.status.success() {
            return Err(anyhow!(
                "docker run failed: {}",
                String::from_utf8_lossy(&out.stderr)
            ));
        }
        let id = String::from_utf8(out.stdout)?.trim().to_string();
        let forwarded_port = self.forwarded_port(&id).await?;
        std::mem::forget(dir);
        Ok(SandboxHandle {
            sandbox_id: id,
            forwarded_port: Some(forwarded_port),
        })
    }

    async fn stop(&self, sandbox_id: &str) -> Result<()> {
        let out = Command::new(&self.binary)
            .args(["rm", "-f", sandbox_id])
            .output()
            .await?;
        if !out.status.success() {
            tracing::warn!(stderr = %String::from_utf8_lossy(&out.stderr), "docker remove");
        }
        Ok(())
    }

    async fn is_running(&self, sandbox_id: &str) -> Result<bool> {
        let out = Command::new(&self.binary)
            .args(["inspect", "--format", "{{.State.Status}}", sandbox_id])
            .output()
            .await?;
        Ok(out.status.success() && String::from_utf8_lossy(&out.stdout).trim() == "running")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec() -> SandboxSpec {
        SandboxSpec {
            booking_id: "b1-a".into(),
            offering_id: "o1".into(),
            image: "claw/agent-base:0.1.0".into(),
            cpu_limit: Some(2),
            memory_limit_mb: Some(4096),
            agent_config: serde_json::Value::Null,
            persist_volume: None,
        }
    }

    #[test]
    fn run_args_publish_loopback_port_and_mount_config() {
        let args = DockerBackend::build_run_args(&spec(), "/tmp/claw.json");
        assert!(args.contains(&"127.0.0.1::8080".to_string()));
        assert!(args.iter().any(|arg| arg.contains("/tmp/claw.json")));
        assert!(args.contains(&"claw/agent-base:0.1.0".to_string()));
    }

    #[test]
    fn ephemeral_sandbox_has_no_persistent_volume() {
        let args = DockerBackend::build_run_args(&spec(), "/tmp/claw.json");
        assert!(!args.iter().any(|a| a.contains(":/claw/state")));
    }

    #[test]
    fn hermes_mounts_named_state_volume() {
        let mut s = spec();
        s.persist_volume = Some("claw-hermes-deadbeef".into());
        let args = DockerBackend::build_run_args(&s, "/tmp/claw.json");
        let i = args.iter().position(|a| a == "-v").expect("has -v flag");
        assert_eq!(args[i + 1], "claw-hermes-deadbeef:/claw/state");
    }

    #[test]
    fn parses_ipv4_and_ipv6_port_output() {
        assert_eq!(parse_forwarded_port("127.0.0.1:49153\n").unwrap(), 49153);
        assert_eq!(parse_forwarded_port("[::1]:49154\n").unwrap(), 49154);
    }

    #[test]
    fn sandbox_name_is_stable() {
        assert_eq!(sandbox_name("ab-cd"), "claw-abcd");
    }
}
