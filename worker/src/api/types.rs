use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkerOut {
    pub id: String,
    pub name: String,
    pub status: String,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub machine_info: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct WorkerRegisterRequest<'a> {
    pub provisioning_token: &'a str,
    pub machine_info: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct WorkerRegisterResponse {
    pub worker_token: String,
    pub worker: WorkerOut,
}

#[derive(Debug, Serialize)]
pub struct HeartbeatRequest {
    pub cpu_pct: f64,
    pub mem_pct: f64,
    pub gpu_pct: Option<f64>,
    pub free_ram_gb: Option<f64>,
    pub model_loaded_id: Option<String>,
}
