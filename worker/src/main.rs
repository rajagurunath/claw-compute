use clap::{Parser, Subcommand};
use claw_worker::api::client::ApiClient;
use claw_worker::api::types::HeartbeatRequest;
use claw_worker::config::Config;
use claw_worker::metrics::Sampler;

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
    let client = ApiClient::new(api_url)?;
    let mut sampler = Sampler::new();
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(15));
    tracing::info!("worker run loop started; heartbeating every 15s");
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
        match client.heartbeat(&token, &hb).await {
            Ok(_) => tracing::debug!(?hb, "heartbeat ok"),
            Err(e) => tracing::warn!(error = ?e, "heartbeat failed; will retry"),
        }
    }
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
