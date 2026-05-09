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
}
