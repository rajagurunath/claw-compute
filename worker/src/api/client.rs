use anyhow::{Context, Result, anyhow};
use reqwest::{Client, StatusCode};
use serde_json::Value;

use super::types::{HeartbeatRequest, WorkerRegisterRequest, WorkerRegisterResponse};

#[derive(Clone)]
pub struct ApiClient {
    base: String,
    http: Client,
}

impl ApiClient {
    pub fn new(base: impl Into<String>) -> Result<Self> {
        let http = Client::builder()
            .user_agent(concat!("claw-worker/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .context("failed to build HTTP client")?;
        Ok(Self {
            base: base.into().trim_end_matches('/').to_string(),
            http,
        })
    }

    pub fn base(&self) -> &str {
        &self.base
    }

    pub async fn register(
        &self,
        provisioning_token: &str,
        machine_info: Value,
    ) -> Result<WorkerRegisterResponse> {
        let body = WorkerRegisterRequest {
            provisioning_token,
            machine_info,
        };
        let resp = self
            .http
            .post(format!("{}/v1/workers/register", self.base))
            .json(&body)
            .send()
            .await?;
        match resp.status() {
            StatusCode::OK => Ok(resp.json().await?),
            s => Err(anyhow!("register failed: {s}")),
        }
    }

    pub async fn heartbeat(&self, worker_token: &str, hb: &HeartbeatRequest) -> Result<()> {
        let resp = self
            .http
            .post(format!("{}/v1/workers/heartbeat", self.base))
            .bearer_auth(worker_token)
            .json(hb)
            .send()
            .await?;
        if resp.status().is_success() {
            Ok(())
        } else {
            Err(anyhow!("heartbeat failed: {}", resp.status()))
        }
    }

    /// Worker-only endpoint for posting an assistant reply produced by the
    /// sandbox. Requires the worker JWT and that the booking belongs to this
    /// worker (server enforces both).
    pub async fn post_assistant_message(
        &self,
        worker_token: &str,
        booking_id: &str,
        content: &str,
    ) -> Result<()> {
        let resp = self
            .http
            .post(format!(
                "{}/v1/bookings/{booking_id}/messages/internal",
                self.base
            ))
            .bearer_auth(worker_token)
            .json(&serde_json::json!({ "content": content }))
            .send()
            .await?;
        if resp.status().is_success() {
            Ok(())
        } else {
            Err(anyhow!(
                "post_assistant_message failed: {}",
                resp.status()
            ))
        }
    }

    /// Sandbox-side call: POST a chat completion to the agent runtime
    /// listening on `127.0.0.1:<port>` (set by the SandboxBackend at start).
    /// The agent runtime in turn calls `host.containers.internal:9000` (mlx-lm).
    pub async fn sandbox_chat(
        &self,
        port: u16,
        content: &str,
    ) -> Result<String> {
        let url = format!("http://127.0.0.1:{port}/v1/chat/completions");
        let body = serde_json::json!({
            "messages": [{"role": "user", "content": content}]
        });
        let resp = self.http.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("sandbox_chat status {}", resp.status()));
        }
        let json: Value = resp.json().await?;
        let reply = json["choices"][0]["message"]["content"]
            .as_str()
            .context("sandbox response missing choices[0].message.content")?
            .to_string();
        Ok(reply)
    }
}
