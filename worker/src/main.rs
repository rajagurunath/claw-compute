mod config;
mod state;

use clap::{Parser, Subcommand};

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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let cli = Cli::parse();
    match cli.command {
        Command::Info => {
            println!("claw-worker {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        Command::Register { .. } => {
            anyhow::bail!("register: not implemented (Task 3)")
        }
        Command::Run { .. } => {
            anyhow::bail!("run: not implemented (Task 4)")
        }
    }
}
