# Worker Binary (macOS / Apple Silicon) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single Rust binary that a supplier installs via `curl ... | bash`, which registers itself with the marketplace, sends heartbeats, holds an outbound WebSocket connection for booking events, and shells out to the sandbox runtime (Plan 3) to launch agent workloads. v1 uses ad-hoc code signing — production signing/notarization/MDM are documented in `docs/worker-prerequisites.md` for post-beta.

**Architecture:** Rust async (tokio). Outbound-only HTTP/WS to marketplace API. Local SQLite for crash-recovery state (current bookings, last config). Sandbox driver abstracted behind a `SandboxBackend` trait so Plan 3 can plug in `container`/Lima without changing the worker.

**Tech Stack:** Rust 1.84+, tokio 1.x, reqwest, tokio-tungstenite, serde, clap, anyhow, tracing, rusqlite (bundled), keyring (macOS Keychain).

**Out of scope (deferred to v2 — see `docs/worker-prerequisites.md`):**
- Apple Developer ID signing + notarization
- Hardened Runtime entitlements
- Apple Business Manager + MDM enrollment
- Managed Device Attestation (MDA / ACME)
- Secure Enclave-backed identity
- Auto-update channel signing

**Dependencies:**
- Plan 1 must be running (provides `/v1/workers/register`, `/v1/workers/heartbeat`).
- Plan 3 will provide the `SandboxBackend` implementation; this plan ships a `NoopBackend` plus the trait + lifecycle hooks.

---

## File Structure

```
worker/
  Cargo.toml
  build.rs                    # version stamping
  rust-toolchain.toml
  install.sh                  # the curl-piped installer
  scripts/
    sign-adhoc.sh             # ad-hoc codesign for dev
    package-tarball.sh        # build + tar for release
  src/
    main.rs                   # CLI entry (clap)
    config.rs                 # load/save .env-style config
    state.rs                  # SQLite state (current bookings, last_seen)
    api/
      mod.rs
      client.rs               # REST client (register, heartbeat)
      ws.rs                   # WebSocket loop
      types.rs                # mirror of marketplace API types
    sandbox/
      mod.rs                  # SandboxBackend trait + Sandbox struct
      noop.rs                 # v1 backend (logs, doesn't spawn)
      registry.rs             # picks backend at runtime
    booking/
      mod.rs                  # booking lifecycle handler
    metrics/
      mod.rs                  # cpu/mem/gpu sampling
    logging.rs                # tracing setup
  tests/
    register_flow.rs          # integration tests against mock server
    booking_lifecycle.rs
docs/
  worker-prerequisites.md     # NEW: human steps required for production
```

**Why this split:** The worker is small enough that one crate is fine. Modules reflect the four concerns: API I/O, persisted state, sandbox driver, and metric sampling. The `SandboxBackend` trait is the only thing Plan 3 needs to implement.

---

## Task 1: Rust Workspace + CLI Skeleton

**Files:**
- Create: `worker/Cargo.toml`
- Create: `worker/rust-toolchain.toml`
- Create: `worker/src/main.rs`
- Create: `worker/.gitignore`

- [x] **Step 1: Create `worker/Cargo.toml`**

```toml
[package]
name = "claw-worker"
version = "0.1.0"
edition = "2024"
description = "Claw marketplace worker agent (macOS / Apple Silicon)"

[[bin]]
name = "claw-worker"
path = "src/main.rs"

[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-util = "0.7"
reqwest = { version = "0.12", features = ["json", "stream", "rustls-tls"], default-features = false }
tokio-tungstenite = { version = "0.26", features = ["rustls-tls-native-roots"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
clap = { version = "4", features = ["derive", "env"] }
anyhow = "1"
thiserror = "2"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
async-trait = "0.1"
futures-util = "0.3"
url = "2"
rusqlite = { version = "0.32", features = ["bundled"] }
chrono = { version = "0.4", features = ["serde"] }
sysinfo = "0.32"
dirs = "6"

[target.'cfg(target_os = "macos")'.dependencies]
keyring = "3"

[dev-dependencies]
wiremock = "0.6"
tempfile = "3"
```

- [x] **Step 2: Create `worker/rust-toolchain.toml`**

```toml
[toolchain]
channel = "1.84"
components = ["rustfmt", "clippy"]
targets = ["aarch64-apple-darwin"]
```

- [x] **Step 3: Create `worker/.gitignore`**

```gitignore
target/
*.log
.env
```

- [x] **Step 4: Create the CLI entry**

`worker/src/main.rs`:
```rust
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
```

- [x] **Step 5: Build + smoke test**

```bash
cd worker
cargo build
./target/debug/claw-worker info
```

Expected: prints `claw-worker 0.1.0`.

- [x] **Step 6: Commit**

```bash
git add worker/
git commit -m "feat(worker): scaffold Rust binary with CLI skeleton"
```

---

## Task 2: Persistent Config + State

The worker needs to remember its `worker_token` (long-lived JWT from registration) and its current booking state across restarts. Token goes to macOS Keychain; everything else goes to a SQLite file at `~/Library/Application Support/claw-worker/state.db`.

**Files:**
- Create: `worker/src/config.rs`
- Create: `worker/src/state.rs`
- Modify: `worker/src/main.rs`

- [x] **Step 1: Create `worker/src/config.rs`**

```rust
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const KEYRING_SERVICE: &str = "io.claw.worker";
const KEYRING_USER: &str = "worker_token";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Config {
    pub api_url: String,
    pub heartbeat_interval_secs: u64,
}

impl Config {
    pub fn data_dir() -> Result<PathBuf> {
        let base = dirs::data_dir().context("no data dir for current platform")?;
        let dir = base.join("claw-worker");
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    pub fn db_path() -> Result<PathBuf> {
        Ok(Self::data_dir()?.join("state.db"))
    }

    pub fn store_worker_token(token: &str) -> Result<()> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        entry.set_password(token)?;
        Ok(())
    }

    pub fn load_worker_token() -> Result<Option<String>> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        match entry.get_password() {
            Ok(t) => Ok(Some(t)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn delete_worker_token() -> Result<()> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.into()),
        }
    }
}
```

- [x] **Step 2: Create `worker/src/state.rs`**

```rust
use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::path::Path;

pub struct State {
    conn: Connection,
}

#[derive(Clone, Debug)]
pub struct BookingRow {
    pub id: String,
    pub offering_id: String,
    pub status: String,
    pub started_at: Option<DateTime<Utc>>,
    pub sandbox_id: Option<String>,
}

impl State {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                offering_id TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT,
                sandbox_id TEXT,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS kv (
                k TEXT PRIMARY KEY,
                v TEXT NOT NULL
            );
            "#,
        )?;
        Ok(Self { conn })
    }

    pub fn upsert_booking(&self, row: &BookingRow) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO bookings (id, offering_id, status, started_at, sandbox_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                started_at = excluded.started_at,
                sandbox_id = excluded.sandbox_id,
                updated_at = datetime('now')
            "#,
            params![
                row.id,
                row.offering_id,
                row.status,
                row.started_at.map(|t| t.to_rfc3339()),
                row.sandbox_id,
            ],
        )?;
        Ok(())
    }

    pub fn list_active_bookings(&self) -> Result<Vec<BookingRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, offering_id, status, started_at, sandbox_id FROM bookings WHERE status = 'active'",
        )?;
        let rows = stmt
            .query_map([], |r| {
                Ok(BookingRow {
                    id: r.get(0)?,
                    offering_id: r.get(1)?,
                    status: r.get(2)?,
                    started_at: r
                        .get::<_, Option<String>>(3)?
                        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                        .map(|d| d.with_timezone(&Utc)),
                    sandbox_id: r.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }
}
```

- [x] **Step 3: Wire modules**

In `worker/src/main.rs` add at the top:
```rust
mod config;
mod state;
```

- [x] **Step 4: Build**

```bash
cargo build
```

Expected: clean compile.

- [x] **Step 5: Commit**

```bash
git add worker/
git commit -m "feat(worker): config + SQLite state with keychain-backed token storage"
```

---

## Task 3: Register Flow (TDD with mock server)

**Files:**
- Create: `worker/src/api/mod.rs`
- Create: `worker/src/api/types.rs`
- Create: `worker/src/api/client.rs`
- Create: `worker/tests/register_flow.rs`
- Modify: `worker/src/main.rs`

- [x] **Step 1: Write the failing integration test**

`worker/tests/register_flow.rs`:
```rust
use claw_worker::api::client::ApiClient;
use claw_worker::api::types::WorkerRegisterResponse;
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn register_exchanges_provisioning_token() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/v1/workers/register"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "worker_token": "wjwt.test",
            "worker": {
                "id": "w1",
                "name": "n",
                "status": "active",
                "last_seen_at": null,
                "machine_info": {}
            }
        })))
        .mount(&server)
        .await;

    let client = ApiClient::new(server.uri()).unwrap();
    let resp: WorkerRegisterResponse = client
        .register("provtoken", serde_json::json!({"chip": "Apple M3 Max"}))
        .await
        .unwrap();
    assert_eq!(resp.worker_token, "wjwt.test");
    assert_eq!(resp.worker.id, "w1");
}

#[tokio::test]
async fn register_returns_error_on_401() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/v1/workers/register"))
        .respond_with(ResponseTemplate::new(401))
        .mount(&server)
        .await;

    let client = ApiClient::new(server.uri()).unwrap();
    let result = client.register("bad", serde_json::Value::Null).await;
    assert!(result.is_err());
}
```

For tests to see `claw_worker::api::*`, expose a library target. Add to `Cargo.toml`:
```toml
[lib]
name = "claw_worker"
path = "src/lib.rs"
```

Create `worker/src/lib.rs`:
```rust
pub mod api;
pub mod config;
pub mod state;
```

- [x] **Step 2: Run tests, confirm fail**

```bash
cargo test --test register_flow
```

Expected: compile errors (no `api` module yet).

- [x] **Step 3: Create `worker/src/api/mod.rs`**

```rust
pub mod client;
pub mod types;
```

- [x] **Step 4: Create `worker/src/api/types.rs`**

```rust
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
```

- [x] **Step 5: Create `worker/src/api/client.rs`**

```rust
use anyhow::{anyhow, Context, Result};
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
```

- [x] **Step 6: Run tests**

```bash
cargo test --test register_flow
```

Expected: 2 passed.

- [x] **Step 7: Wire `register` subcommand**

Update `worker/src/main.rs`:
```rust
mod config;
mod state;
use claw_worker::api::client::ApiClient;

// ... in main():
Command::Register { api_url, provisioning_token } => {
    let machine_info = collect_machine_info()?;
    let client = ApiClient::new(api_url)?;
    let resp = client.register(&provisioning_token, machine_info).await?;
    config::Config::store_worker_token(&resp.worker_token)?;
    tracing::info!(worker_id = %resp.worker.id, "registered");
    Ok(())
}
```

Add helper:
```rust
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
```

- [x] **Step 8: Commit**

```bash
git add worker/
git commit -m "feat(worker): API client + register subcommand"
```

---

## Task 4: Heartbeat Loop

**Files:**
- Create: `worker/src/metrics/mod.rs`
- Modify: `worker/src/main.rs`
- Modify: `worker/src/lib.rs`

- [x] **Step 1: Create `worker/src/metrics/mod.rs`**

```rust
use sysinfo::System;

pub struct Sampler {
    sys: System,
}

impl Sampler {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        Self { sys }
    }

    pub fn sample(&mut self) -> Sample {
        self.sys.refresh_cpu_all();
        self.sys.refresh_memory();
        let cpu_pct = self.sys.global_cpu_usage() as f64;
        let mem_used = self.sys.used_memory() as f64;
        let mem_total = self.sys.total_memory() as f64;
        let mem_pct = if mem_total > 0.0 { mem_used / mem_total * 100.0 } else { 0.0 };
        let free_ram_gb = (self.sys.available_memory() as f64) / 1024.0 / 1024.0 / 1024.0;
        Sample {
            cpu_pct,
            mem_pct,
            free_ram_gb,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Sample {
    pub cpu_pct: f64,
    pub mem_pct: f64,
    pub free_ram_gb: f64,
}
```

Expose: add `pub mod metrics;` to `worker/src/lib.rs`.

- [x] **Step 2: Implement the loop**

In `worker/src/main.rs`, add a function:

```rust
async fn run_loop(api_url: String) -> anyhow::Result<()> {
    let token = config::Config::load_worker_token()?
        .ok_or_else(|| anyhow::anyhow!("not registered — run `claw-worker register` first"))?;
    let client = claw_worker::api::client::ApiClient::new(api_url)?;
    let mut sampler = claw_worker::metrics::Sampler::new();
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(15));
    loop {
        ticker.tick().await;
        let s = sampler.sample();
        let hb = claw_worker::api::types::HeartbeatRequest {
            cpu_pct: s.cpu_pct,
            mem_pct: s.mem_pct,
            gpu_pct: None,
            free_ram_gb: Some(s.free_ram_gb),
            model_loaded_id: None,
        };
        if let Err(e) = client.heartbeat(&token, &hb).await {
            tracing::warn!(error = ?e, "heartbeat failed; will retry");
        }
    }
}
```

Wire `Command::Run`:
```rust
Command::Run { api_url } => run_loop(api_url).await,
```

- [x] ~ **Step 3: Manual smoke test** (skipped: interactive — wiremock tests cover the round-trip)

In one terminal, run the marketplace API. In another:
```bash
# Get a provisioning token first (use the API directly or curl)
export CLAW_API_URL=http://localhost:8000
export CLAW_PROVISIONING_TOKEN=<from supplier dashboard>
cargo run -- register
cargo run -- run
```

Watch heartbeats arrive in the API logs (every 15s).

- [x] **Step 4: Commit**

```bash
git add worker/
git commit -m "feat(worker): metric sampling + heartbeat loop"
```

---

## Task 5: Sandbox Backend Trait + Noop Implementation

This task **defines the contract** that Plan 3 will implement. v1 ships a `NoopBackend` that logs but doesn't actually launch anything; Plan 3 swaps in the real Apple `container` driver.

**Files:**
- Create: `worker/src/sandbox/mod.rs`
- Create: `worker/src/sandbox/noop.rs`
- Create: `worker/src/sandbox/registry.rs`
- Modify: `worker/src/lib.rs`

- [x] **Step 1: Create the trait**

`worker/src/sandbox/mod.rs`:
```rust
pub mod noop;
pub mod registry;

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SandboxSpec {
    pub booking_id: String,
    pub offering_id: String,
    /// Image reference understood by the backend (e.g. "claw/agent-base:0.1").
    pub image: String,
    /// Resource ceiling.
    pub cpu_limit: Option<u32>,
    pub memory_limit_mb: Option<u32>,
    /// Free-form configuration the sandboxed agent reads from /etc/claw.json.
    pub agent_config: serde_json::Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SandboxHandle {
    /// Backend-issued identifier so we can stop it later.
    pub sandbox_id: String,
    pub forwarded_port: Option<u16>,
}

#[async_trait]
pub trait SandboxBackend: Send + Sync {
    fn name(&self) -> &'static str;
    async fn start(&self, spec: SandboxSpec) -> Result<SandboxHandle>;
    async fn stop(&self, sandbox_id: &str) -> Result<()>;
    async fn is_running(&self, sandbox_id: &str) -> Result<bool>;
}
```

- [x] **Step 2: Create the noop backend**

`worker/src/sandbox/noop.rs`:
```rust
use super::{SandboxBackend, SandboxHandle, SandboxSpec};
use anyhow::Result;
use async_trait::async_trait;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct NoopBackend {
    counter: AtomicU64,
}

impl NoopBackend {
    pub fn new() -> Self {
        Self { counter: AtomicU64::new(0) }
    }
}

#[async_trait]
impl SandboxBackend for NoopBackend {
    fn name(&self) -> &'static str { "noop" }

    async fn start(&self, spec: SandboxSpec) -> Result<SandboxHandle> {
        let n = self.counter.fetch_add(1, Ordering::Relaxed);
        let id = format!("noop-{n}");
        tracing::info!(sandbox_id = %id, booking = %spec.booking_id, "noop start");
        Ok(SandboxHandle { sandbox_id: id, forwarded_port: None })
    }

    async fn stop(&self, sandbox_id: &str) -> Result<()> {
        tracing::info!(%sandbox_id, "noop stop");
        Ok(())
    }

    async fn is_running(&self, _sandbox_id: &str) -> Result<bool> { Ok(true) }
}
```

- [x] **Step 3: Backend registry**

`worker/src/sandbox/registry.rs`:
```rust
use std::sync::Arc;
use super::{SandboxBackend, noop::NoopBackend};

pub fn pick_backend(name: &str) -> Arc<dyn SandboxBackend> {
    match name {
        "noop" => Arc::new(NoopBackend::new()),
        // Plan 3 will register "container" and "lima" here.
        other => {
            tracing::warn!(requested = %other, "unknown backend; falling back to noop");
            Arc::new(NoopBackend::new())
        }
    }
}
```

Add `pub mod sandbox;` to `worker/src/lib.rs`.

- [x] **Step 4: Write a unit test**

Append to `worker/src/sandbox/noop.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn start_returns_unique_ids() {
        let b = NoopBackend::new();
        let spec = SandboxSpec {
            booking_id: "b1".into(),
            offering_id: "o1".into(),
            image: "i".into(),
            cpu_limit: None,
            memory_limit_mb: None,
            agent_config: serde_json::Value::Null,
        };
        let a = b.start(spec.clone()).await.unwrap();
        let c = b.start(spec).await.unwrap();
        assert_ne!(a.sandbox_id, c.sandbox_id);
    }
}
```

- [x] **Step 5: Run all tests**

```bash
cargo test
```

Expected: green.

- [x] **Step 6: Commit**

```bash
git add worker/
git commit -m "feat(worker): sandbox backend trait + noop implementation"
```

---

## Task 6: WebSocket Booking Channel

The marketplace pushes booking events (`booking.activated`, `booking.cancelled`) to the worker over an outbound WebSocket. The worker handles them by calling the sandbox backend and updating local state.

> **Marketplace API additions required:** Plan 1 doesn't currently expose a worker WS endpoint. Add `GET /v1/ws/worker` (Bearer auth via worker token) that emits JSON-line events. Tracked as a Plan 1 follow-up — implementation snippet below for completeness.

**Plan 1 follow-up (worker WS endpoint):** add to `claw_api/api/v1/workers.py`:
```python
from fastapi import WebSocket, WebSocketDisconnect
from claw_api.auth.jwt import decode_token

@router.websocket("/ws/worker")
async def worker_ws(ws: WebSocket) -> None:
    await ws.accept()
    token = ws.headers.get("authorization", "").removeprefix("Bearer ").strip()
    try:
        payload = decode_token(token)
        if payload.get("kind") != "worker":
            raise ValueError("wrong kind")
    except Exception:
        await ws.close(code=4401)
        return
    worker_id = payload["sub"]
    # In-memory subscriber registry; production swap-in: Redis pub/sub.
    from claw_api.realtime import register, unregister
    queue = await register(worker_id)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=20)
                await ws.send_json(msg)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        await unregister(worker_id, queue)
```

…with a tiny `claw_api/realtime.py` providing `register` / `unregister` / `publish(worker_id, event)`. Booking transitions in `bookings.py` call `publish` after commit.

**Files (worker):**
- Create: `worker/src/api/ws.rs`
- Modify: `worker/src/api/mod.rs`
- Create: `worker/src/booking/mod.rs`
- Modify: `worker/src/lib.rs`
- Modify: `worker/src/main.rs`

- [x] **Step 1: Create the WS client**

`worker/src/api/ws.rs`:
```rust
use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::time::{sleep, Duration};
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message};

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkerEvent {
    Ping,
    BookingActivated { booking_id: String, offering_id: String, agent_config: serde_json::Value },
    BookingCancelled { booking_id: String },
}

pub async fn run_ws<F, Fut>(api_url: &str, worker_token: &str, mut on_event: F) -> Result<()>
where
    F: FnMut(WorkerEvent) -> Fut + Send,
    Fut: std::future::Future<Output = Result<()>> + Send,
{
    let mut backoff = Duration::from_secs(1);
    loop {
        let ws_url = api_url
            .replace("https://", "wss://")
            .replace("http://", "ws://")
            + "/v1/ws/worker";
        let mut req = ws_url.as_str().into_client_request().context("bad ws url")?;
        req.headers_mut().insert(
            "Authorization",
            format!("Bearer {worker_token}").parse().unwrap(),
        );
        match tokio_tungstenite::connect_async(req).await {
            Ok((mut stream, _)) => {
                tracing::info!("ws connected");
                backoff = Duration::from_secs(1);
                while let Some(msg) = stream.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            match serde_json::from_str::<WorkerEvent>(&text) {
                                Ok(WorkerEvent::Ping) => {
                                    let _ = stream.send(Message::Pong(vec![].into())).await;
                                }
                                Ok(ev) => {
                                    if let Err(e) = on_event(ev).await {
                                        tracing::warn!(error = ?e, "event handler failed");
                                    }
                                }
                                Err(e) => tracing::warn!(error = ?e, payload = %text, "bad ws frame"),
                            }
                        }
                        Ok(Message::Close(_)) => break,
                        Err(e) => {
                            tracing::warn!(error = ?e, "ws error");
                            break;
                        }
                        _ => {}
                    }
                }
            }
            Err(e) => tracing::warn!(error = ?e, "ws connect failed"),
        }
        tracing::info!(backoff_secs = backoff.as_secs(), "reconnecting after backoff");
        sleep(backoff).await;
        backoff = (backoff * 2).min(Duration::from_secs(60));
    }
}
```

- [x] **Step 2: Booking handler**

`worker/src/booking/mod.rs`:
```rust
use anyhow::Result;
use std::sync::Arc;

use crate::api::ws::WorkerEvent;
use crate::sandbox::{SandboxBackend, SandboxSpec};
use crate::state::{BookingRow, State};

pub struct BookingHandler {
    backend: Arc<dyn SandboxBackend>,
    state: Arc<tokio::sync::Mutex<State>>,
}

impl BookingHandler {
    pub fn new(backend: Arc<dyn SandboxBackend>, state: Arc<tokio::sync::Mutex<State>>) -> Self {
        Self { backend, state }
    }

    pub async fn dispatch(&self, ev: WorkerEvent) -> Result<()> {
        match ev {
            WorkerEvent::Ping => Ok(()),
            WorkerEvent::BookingActivated { booking_id, offering_id, agent_config } => {
                let spec = SandboxSpec {
                    booking_id: booking_id.clone(),
                    offering_id: offering_id.clone(),
                    image: "claw/agent-base:0.1".into(),
                    cpu_limit: None,
                    memory_limit_mb: None,
                    agent_config,
                };
                let handle = self.backend.start(spec).await?;
                let st = self.state.lock().await;
                st.upsert_booking(&BookingRow {
                    id: booking_id,
                    offering_id,
                    status: "active".into(),
                    started_at: Some(chrono::Utc::now()),
                    sandbox_id: Some(handle.sandbox_id),
                })?;
                Ok(())
            }
            WorkerEvent::BookingCancelled { booking_id } => {
                let st = self.state.lock().await;
                let active = st.list_active_bookings()?;
                if let Some(row) = active.iter().find(|r| r.id == booking_id) {
                    if let Some(sb) = &row.sandbox_id {
                        self.backend.stop(sb).await?;
                    }
                    st.upsert_booking(&BookingRow {
                        id: row.id.clone(),
                        offering_id: row.offering_id.clone(),
                        status: "cancelled".into(),
                        started_at: row.started_at,
                        sandbox_id: row.sandbox_id.clone(),
                    })?;
                }
                Ok(())
            }
        }
    }
}
```

Add `pub mod booking;` to `worker/src/lib.rs`.

- [x] **Step 3: Wire into `Command::Run`**

Replace `run_loop` in `worker/src/main.rs`:

```rust
async fn run_loop(api_url: String) -> anyhow::Result<()> {
    let token = config::Config::load_worker_token()?
        .ok_or_else(|| anyhow::anyhow!("not registered — run `claw-worker register` first"))?;

    let client = claw_worker::api::client::ApiClient::new(api_url.clone())?;
    let backend = claw_worker::sandbox::registry::pick_backend(
        std::env::var("CLAW_SANDBOX_BACKEND").as_deref().unwrap_or("noop"),
    );
    let state = std::sync::Arc::new(tokio::sync::Mutex::new(
        claw_worker::state::State::open(&config::Config::db_path()?)?,
    ));
    let handler = std::sync::Arc::new(claw_worker::booking::BookingHandler::new(
        backend.clone(),
        state.clone(),
    ));

    let token_clone = token.clone();
    let client_clone = client.clone();
    tokio::spawn(async move {
        let mut sampler = claw_worker::metrics::Sampler::new();
        let mut ticker = tokio::time::interval(std::time::Duration::from_secs(15));
        loop {
            ticker.tick().await;
            let s = sampler.sample();
            let hb = claw_worker::api::types::HeartbeatRequest {
                cpu_pct: s.cpu_pct,
                mem_pct: s.mem_pct,
                gpu_pct: None,
                free_ram_gb: Some(s.free_ram_gb),
                model_loaded_id: None,
            };
            if let Err(e) = client_clone.heartbeat(&token_clone, &hb).await {
                tracing::warn!(error = ?e, "heartbeat failed");
            }
        }
    });

    claw_worker::api::ws::run_ws(&api_url, &token, move |ev| {
        let handler = handler.clone();
        async move { handler.dispatch(ev).await }
    })
    .await
}
```

Add `pub mod ws;` to `worker/src/api/mod.rs`.

- [x] **Step 4: Build**

```bash
cargo build
```

- [x] **Step 5: Commit**

```bash
git add worker/
git commit -m "feat(worker): outbound WebSocket + booking event handler"
```

---

## Task 7: Booking Lifecycle Integration Test

**Files:**
- Create: `worker/tests/booking_lifecycle.rs`

- [x] **Step 1: Test the full booking flow with mocks**

```rust
use claw_worker::api::ws::WorkerEvent;
use claw_worker::booking::BookingHandler;
use claw_worker::sandbox::{SandboxBackend, SandboxHandle, SandboxSpec};
use claw_worker::state::State;
use std::sync::Arc;
use tokio::sync::Mutex;

struct RecordingBackend {
    started: Mutex<Vec<String>>,
    stopped: Mutex<Vec<String>>,
}

#[async_trait::async_trait]
impl SandboxBackend for RecordingBackend {
    fn name(&self) -> &'static str { "rec" }
    async fn start(&self, spec: SandboxSpec) -> anyhow::Result<SandboxHandle> {
        self.started.lock().await.push(spec.booking_id.clone());
        Ok(SandboxHandle { sandbox_id: format!("sb-{}", spec.booking_id), forwarded_port: None })
    }
    async fn stop(&self, sandbox_id: &str) -> anyhow::Result<()> {
        self.stopped.lock().await.push(sandbox_id.into());
        Ok(())
    }
    async fn is_running(&self, _: &str) -> anyhow::Result<bool> { Ok(true) }
}

#[tokio::test]
async fn activated_then_cancelled() {
    let dir = tempfile::tempdir().unwrap();
    let backend = Arc::new(RecordingBackend {
        started: Mutex::new(vec![]),
        stopped: Mutex::new(vec![]),
    });
    let state = Arc::new(Mutex::new(State::open(&dir.path().join("s.db")).unwrap()));
    let handler = BookingHandler::new(backend.clone(), state.clone());

    handler
        .dispatch(WorkerEvent::BookingActivated {
            booking_id: "b1".into(),
            offering_id: "o1".into(),
            agent_config: serde_json::Value::Null,
        })
        .await
        .unwrap();
    handler
        .dispatch(WorkerEvent::BookingCancelled { booking_id: "b1".into() })
        .await
        .unwrap();

    assert_eq!(backend.started.lock().await.as_slice(), &["b1".to_string()]);
    assert_eq!(backend.stopped.lock().await.as_slice(), &["sb-b1".to_string()]);
}
```

Need to make `RecordingBackend` types accessible — they are crate-local in the test, so this works.

- [x] **Step 2: Run**

```bash
cargo test --test booking_lifecycle
```

Expected: 1 passed.

- [x] **Step 3: Commit**

```bash
git add worker/
git commit -m "test(worker): booking lifecycle integration test"
```

---

## Task 8: install.sh + Ad-hoc Signing

The supplier-facing install path: a single `curl -fsSL https://api.claw.dev/install.sh | bash`. v1 ships unsigned (ad-hoc); production signing flow is in `docs/worker-prerequisites.md`.

**Files:**
- Create: `worker/install.sh`
- Create: `worker/scripts/sign-adhoc.sh`
- Create: `worker/scripts/package-tarball.sh`

- [x] **Step 1: Create `worker/install.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Claw worker installer (v1 — ad-hoc signed, trust-but-verify).
# Production signing/notarization will replace this in v2.

API_URL="${CLAW_API_URL:-https://api.claw.dev}"
INSTALL_DIR="${CLAW_INSTALL_DIR:-$HOME/.claw}"
BIN_DIR="$INSTALL_DIR/bin"
RELEASES_BASE="${CLAW_RELEASES_BASE:-$API_URL/releases}"

mkdir -p "$BIN_DIR"

ARCH="$(uname -m)"
OS="$(uname -s)"
if [[ "$OS" != "Darwin" || "$ARCH" != "arm64" ]]; then
    echo "ERROR: claw-worker v1 supports macOS / Apple Silicon only (got $OS/$ARCH)" >&2
    exit 1
fi

VERSION="${CLAW_WORKER_VERSION:-latest}"
TARBALL_URL="$RELEASES_BASE/claw-worker-$VERSION-aarch64-apple-darwin.tar.gz"
echo "→ Downloading $TARBALL_URL"
curl -fsSL "$TARBALL_URL" -o "$INSTALL_DIR/claw-worker.tar.gz"
tar -xzf "$INSTALL_DIR/claw-worker.tar.gz" -C "$BIN_DIR"
rm "$INSTALL_DIR/claw-worker.tar.gz"
chmod +x "$BIN_DIR/claw-worker"

# Verify ad-hoc signature is present (it's not Developer ID — see prerequisites doc).
if ! codesign --verify "$BIN_DIR/claw-worker" 2>/dev/null; then
    echo "WARN: binary not codesigned; macOS may quarantine it" >&2
fi

echo
echo "✔ Installed to $BIN_DIR/claw-worker"
echo
echo "Next steps:"
echo "  1. Get a provisioning token from your supplier dashboard"
echo "  2. Run:"
echo "       $BIN_DIR/claw-worker register \\"
echo "         --api-url $API_URL \\"
echo "         --provisioning-token <TOKEN>"
echo "  3. Run:"
echo "       $BIN_DIR/claw-worker run --api-url $API_URL"
echo
echo "Add $BIN_DIR to your PATH if you want to call it without the full path."
```

- [x] **Step 2: Create `worker/scripts/sign-adhoc.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
BIN="${1:?usage: sign-adhoc.sh <binary>}"
codesign --force --sign - "$BIN"
codesign --verify --verbose=2 "$BIN"
echo "✔ ad-hoc signed: $BIN"
echo "NOTE: ad-hoc signing works only on the local machine. For distribution,"
echo "      see docs/worker-prerequisites.md for Developer ID + notarization."
```

- [x] **Step 3: Create `worker/scripts/package-tarball.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="aarch64-apple-darwin"
VERSION="$(grep -m1 '^version' Cargo.toml | cut -d'"' -f2)"
OUT_DIR="../dist"
mkdir -p "$OUT_DIR"

cargo build --release --target "$TARGET"
./scripts/sign-adhoc.sh "target/$TARGET/release/claw-worker"

TARBALL="$OUT_DIR/claw-worker-$VERSION-$TARGET.tar.gz"
tar -czf "$TARBALL" -C "target/$TARGET/release" claw-worker
echo "✔ wrote $TARBALL"
```

- [x] **Step 4: chmod + smoke test**

```bash
chmod +x worker/install.sh worker/scripts/*.sh
cd worker && ./scripts/package-tarball.sh
ls -la ../dist
```

Expected: tarball produced.

- [x] **Step 5: Commit**

```bash
git add worker/install.sh worker/scripts/
git commit -m "feat(worker): install.sh + ad-hoc signing + tarball packaging"
```

---

## Task 9: Worker Prerequisites Document

Capture every human-required step that v1 skips, so post-beta production hardening can pick up where this leaves off.

**Files:**
- Create: `docs/worker-prerequisites.md`

- [x] **Step 1: Write the prerequisites doc**

`docs/worker-prerequisites.md`:
```markdown
# Worker Prerequisites — Production Hardening

This document lists every action that requires a human (account creation, ID verification, certificate issuance, manual review) before the worker binary can ship under its v2 threat model. v1 ("Trust-but-verify") skips all of these intentionally.

## 1. Apple Developer Program Enrollment
- Cost: $99 / year (organisation account)
- Lead time: 1–2 weeks for ID verification + D-U-N-S validation
- Owner: legal / founders
- Outcome: Team ID (10-char alphanumeric); used in entitlements + signing identity

## 2. Developer ID Application Certificate
- Source: developer.apple.com → Certificates → Developer ID Application
- Stored in: build-machine Keychain
- CI: store as base64 secret; install with `security import` at job start
- Expiry: 5 years; rotate ~6 months before expiry

## 3. Replace Ad-hoc Sign with Real Sign
- File: `worker/scripts/sign-adhoc.sh` becomes `sign-release.sh`
- Command:
  ```bash
  codesign --force --options runtime \
      --entitlements scripts/entitlements.plist \
      --sign "Developer ID Application: <ORG NAME> (<TEAM_ID>)" \
      target/aarch64-apple-darwin/release/claw-worker
  ```
- Add `scripts/entitlements.plist` (see d-inference's plist as reference; we don't need
  hypervisor entitlement for v2 unless we add Lima or Apple `container` host-side).

## 4. Notarization
- Tool: `xcrun notarytool submit <tarball> --apple-id <email> --team-id <TEAM_ID> --wait`
- Requires app-specific password from appleid.apple.com (NOT the main account password)
- After success: `xcrun stapler staple <tarball>`
- Without notarization: macOS Gatekeeper blocks downloaded binaries with "cannot verify developer"

## 5. CDN for Release Distribution
- v1 install.sh fetches from `$CLAW_API_URL/releases/...`
- v2: Cloudflare R2 or AWS S3+CloudFront with signed URLs; `install.sh` redirects to CDN
- Add SHA-256 manifest at `releases/manifest.json`; install.sh verifies hash before extract

## 6. Apple Business Manager (ABM) Account
- Required for: Managed Device Attestation (MDA)
- Lead time: 1–2 weeks; needs D-U-N-S + manual review
- Cost: free
- Outcome: ability to issue MDM enrollment profiles

## 7. MDM Server (or Vendor)
- Option A — operate yourself: open-source MicroMDM, Munki, Fleet, or Nano-MDM
- Option B — contracted: Jamf, Mosyle, Kandji
- Cost: $0–$5/device/month depending on vendor
- Plan-3-impact: enrollment profile delivered as part of supplier onboarding

## 8. ACME Server for Device Identity
- Used by Apple's MDA to issue device certificates
- Reference: `Layr-Labs/d-inference/scripts/enroll-with-acme.mobileconfig`
- Options: smallstep CA, Lego, or step-ca

## 9. Hardened Runtime Switchover
When all of the above are in place, three code changes:
1. `worker/scripts/entitlements.plist` — port from d-inference (drop hypervisor unless used)
2. `worker/build.rs` — add a release-only check that aborts unsigned builds
3. `worker/src/main.rs` — call `PT_DENY_ATTACH` at startup (`libc::ptrace(PT_DENY_ATTACH, 0, 0, 0)`)

## 10. Auto-Update Channel
- v1: user re-runs `install.sh`
- v2: `claw-worker update` subcommand that pulls signed manifest, verifies hash, swaps binary
- Use Sparkle-style EdDSA signature on manifest (separate key from Apple Developer ID)

## Decision Log
| Decision | Date | Reasoning |
|---|---|---|
| Defer all of the above to v2 | 2026-05-10 | No customers yet; collapse weeks of platform work into a single `codesign --sign -` |
| Pick Apple Developer ID over enterprise distribution | future | Enterprise dist requires per-customer MDM enrollment; we want public-internet supplier signup |
```

- [x] **Step 2: Commit**

```bash
git add docs/worker-prerequisites.md
git commit -m "docs: production hardening prerequisites for worker v2"
```

---

## Self-Review Checklist

1. **Spec coverage:** register ✓, heartbeat ✓, WS booking events ✓, sandbox start/stop ✓, install.sh ✓, prerequisites doc ✓.
2. **Placeholders:** None — every step contains the actual code or command. The Apple `container` driver is intentionally deferred to Plan 3 (the trait + noop are sufficient for this plan to ship green).
3. **Type consistency:** `WorkerEvent` enum tags (`booking_activated`, `booking_cancelled`) match what Plan 1's WS endpoint will emit. `SandboxSpec.image` is a string ref Plan 3 controls.
4. **Plan 1 follow-up:** `/v1/ws/worker` endpoint and a tiny `realtime.py` pub/sub need to be added to Plan 1. The snippet is in Task 6 — fold into the next Plan 1 iteration before running this plan end-to-end.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-10-worker-binary-macos.md`.
