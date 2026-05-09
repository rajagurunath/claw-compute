use clap::{Parser, Subcommand};
use claw_worker::api::client::ApiClient;
use claw_worker::config::Config;

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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
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
        Command::Run { .. } => anyhow::bail!("run: not implemented (Task 4)"),
    }
}
