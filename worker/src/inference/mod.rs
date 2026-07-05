pub mod models;

use std::process::Stdio;
use std::sync::Arc;

use anyhow::{Context, Result, anyhow};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use models::{ModelEntry, lookup};

/// Best-effort child-side hardening applied in the pre-exec window (after
/// fork, before execv into `mlx_lm.server`). Returning an error from here
/// aborts the exec.
///
/// * `PT_DENY_ATTACH` — the mach flag denies future ptrace attaches. It
///   is preserved across exec on macOS, so setting it here protects the
///   Python inference process from operator debuggers.
/// * `RLIMIT_CORE = 0` — no core dump if mlx crashes. Rlimits are
///   inherited across exec.
///
/// All failures are swallowed (best-effort defense-in-depth).
#[cfg(target_os = "macos")]
fn preexec_harden() -> std::io::Result<()> {
    use std::os::raw::c_int;
    const PT_DENY_ATTACH: c_int = 31;
    const RLIMIT_CORE: c_int = 4;
    #[repr(C)]
    struct Rlimit {
        cur: u64,
        max: u64,
    }
    unsafe extern "C" {
        fn ptrace(request: c_int, pid: c_int, addr: *mut u8, data: c_int) -> c_int;
        fn setrlimit(resource: c_int, rlim: *const Rlimit) -> c_int;
    }
    // SAFETY: these two FFI calls only touch the current process. Any failure
    // is intentionally ignored — we'd rather run a slightly-less-hardened
    // subprocess than fail to spawn.
    let _ = unsafe { ptrace(PT_DENY_ATTACH, 0, std::ptr::null_mut(), 0) };
    let rl = Rlimit { cur: 0, max: 0 };
    let _ = unsafe { setrlimit(RLIMIT_CORE, &rl) };
    Ok(())
}

pub struct ModelHost {
    inner: Arc<Mutex<HostState>>,
}

struct HostState {
    current: Option<Running>,
}

struct Running {
    model: &'static ModelEntry,
    child: Child,
    port: u16,
}

impl ModelHost {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HostState { current: None })),
        }
    }

    /// Ensures `model_id` is loaded and serving on `port`. Idempotent: if the
    /// requested model is already running on the requested port, returns
    /// without restarting. Otherwise stops the previous process (if any) and
    /// spawns a fresh `uv tool run mlx_lm.server`.
    pub async fn ensure_loaded(
        &self,
        model_id: &str,
        port: u16,
    ) -> Result<&'static ModelEntry> {
        let entry = lookup(model_id).ok_or_else(|| anyhow!("unknown model id: {model_id}"))?;
        let mut state = self.inner.lock().await;
        if let Some(r) = &state.current
            && r.model.id == entry.id
            && r.port == port
        {
            return Ok(entry);
        }
        if let Some(r) = &state.current {
            tracing::info!(switching_from = %r.model.id, to = %entry.id, "swapping model");
        }
        if let Some(mut r) = state.current.take() {
            let _ = r.child.kill().await;
        }
        tracing::info!(model = %entry.id, repo = %entry.hf_repo, port, "launching mlx-lm server");
        let uv = which::which("uv").context("`uv` not on PATH (run bootstrap-host-deps.sh)")?;
        let mut cmd = Command::new(&uv);
        cmd.args([
            "tool",
            "run",
            "--from",
            "mlx-lm",
            "mlx_lm.server",
            "--model",
            entry.hf_repo,
            "--host",
            "127.0.0.1",
            "--port",
            &port.to_string(),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

        // SAFETY: preexec_harden only calls async-signal-safe FFI (ptrace,
        // setrlimit) with no heap allocation. It never blocks, never spawns
        // threads, and returns before execv runs — satisfying pre_exec's
        // signal-safety contract. `tokio::process::Command::pre_exec` is a
        // native method on unix (no trait import required).
        #[cfg(target_os = "macos")]
        unsafe {
            cmd.pre_exec(preexec_harden);
        }

        let child = cmd.spawn().context("spawning mlx_lm.server")?;
        state.current = Some(Running {
            model: entry,
            child,
            port,
        });
        Ok(entry)
    }

    pub async fn stop(&self) -> Result<()> {
        let mut state = self.inner.lock().await;
        if let Some(mut r) = state.current.take() {
            let _ = r.child.kill().await;
        }
        Ok(())
    }
}

impl Default for ModelHost {
    fn default() -> Self {
        Self::new()
    }
}
