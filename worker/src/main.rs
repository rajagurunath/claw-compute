use std::sync::Arc;

use clap::{Parser, Subcommand};
use claw_worker::api::client::ApiClient;
use claw_worker::api::types::HeartbeatRequest;
use claw_worker::booking::{BookingHandler, MODEL_HOST_PORT};
use claw_worker::config::Config;
use claw_worker::inference::ModelHost;
use claw_worker::metrics::Sampler;
use claw_worker::sandbox::registry::pick_backend;
use claw_worker::state::State;

#[derive(Parser)]
#[command(name = "claw-worker", version, about = "Claw marketplace worker agent")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// One-shot: exchange a provisioning token for a worker token.
    Register {
        #[arg(long, env = "CLAW_API_URL")]
        api_url: String,
        #[arg(long, env = "CLAW_PROVISIONING_TOKEN")]
        provisioning_token: String,
    },
    /// Long-running: heartbeat loop + WebSocket booking handler.
    Run {
        #[arg(long, env = "CLAW_API_URL")]
        api_url: String,
    },
    /// Print version + machine info, exit.
    Info,
}

fn collect_machine_info() -> anyhow::Result<serde_json::Value> {
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_all();
    Ok(serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "cpu_count": sys.cpus().len(),
        "total_ram_gb": (sys.total_memory() as f64) / 1024.0 / 1024.0 / 1024.0,
    }))
}

async fn run_loop(api_url: String) -> anyhow::Result<()> {
    let token = Config::load_worker_token()?
        .ok_or_else(|| anyhow::anyhow!("not registered — run `claw-worker register` first"))?;

    let client = ApiClient::new(api_url.clone())?;
    let backend_name = std::env::var("CLAW_SANDBOX_BACKEND").unwrap_or_else(|_| "noop".into());
    let backend = pick_backend(&backend_name);
    tracing::info!(backend = backend.name(), "sandbox backend selected");

    let state = Arc::new(tokio::sync::Mutex::new(State::open(&Config::db_path()?)?));

    let model_host = Arc::new(ModelHost::new());
    // Pre-warm default model in the background so the first booking doesn't
    // wait for the cold-start. Ignore errors — subsequent ensure_loaded calls
    // will surface them.
    let mh_warm = model_host.clone();
    tokio::spawn(async move {
        if let Err(e) = mh_warm.ensure_loaded("qwen", MODEL_HOST_PORT).await {
            tracing::warn!(error = ?e, "failed to pre-warm default model");
        }
    });

    let handler = Arc::new(
        BookingHandler::new(backend.clone(), state.clone()).with_model_host(model_host.clone()),
    );

    // Heartbeat loop in a separate task.
    let token_for_hb = token.clone();
    let client_for_hb = client.clone();
    tokio::spawn(async move {
        let mut sampler = Sampler::new();
        let mut ticker = tokio::time::interval(std::time::Duration::from_secs(15));
        loop {
            ticker.tick().await;
            let s = sampler.sample();
            let hb = HeartbeatRequest {
                cpu_pct: s.cpu_pct,
                mem_pct: s.mem_pct,
                gpu_pct: None,
                free_ram_gb: Some(s.free_ram_gb),
                model_loaded_id: None,
            };
            if let Err(e) = client_for_hb.heartbeat(&token_for_hb, &hb).await {
                tracing::warn!(error = ?e, "heartbeat failed");
            }
        }
    });

    // WS loop runs forever (reconnects internally).
    claw_worker::api::ws::run_ws(&api_url, &token, move |ev| {
        let handler = handler.clone();
        async move { handler.dispatch(ev).await }
    })
    .await
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();
    let cli = Cli::parse();
    match cli.command {
        Command::Info => {
            println!("claw-worker {}", env!("CARGO_PKG_VERSION"));
            let info = collect_machine_info()?;
            println!("{}", serde_json::to_string_pretty(&info)?);
            Ok(())
        }
        Command::Register {
            api_url,
            provisioning_token,
        } => {
            let machine_info = collect_machine_info()?;
            let client = ApiClient::new(api_url)?;
            let resp = client.register(&provisioning_token, machine_info).await?;
            Config::store_worker_token(&resp.worker_token)?;
            tracing::info!(worker_id = %resp.worker.id, "registered");
            println!("✔ Registered worker {}", resp.worker.id);
            Ok(())
        }
        Command::Run { api_url } => run_loop(api_url).await,
    }
}
