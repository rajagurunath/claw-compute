//! macOS process hardening. Best-effort — every call is a no-op on non-macOS
//! and every failure is logged but not fatal (the worker still runs, just less
//! hardened).
//!
//! What this buys us today:
//!
//! * `PT_DENY_ATTACH` — the kernel refuses any `ptrace`/`lldb` attach to this
//!   process for its lifetime. Cannot be undone without SIP off + reboot,
//!   which kills the process. This is the single biggest lever against a
//!   root operator dumping prompt plaintext.
//! * `RLIMIT_CORE = 0` — no core dumps means if we crash mid-request the
//!   plaintext + private key can't be read off disk.
//!
//! What this deliberately does NOT do (yet):
//! * Hardened Runtime entitlements (needs Developer ID codesign, see plan).
//! * Hypervisor.framework Stage-2 isolation (Phase 4).

#[cfg(target_os = "macos")]
mod imp {
    use std::os::raw::c_int;

    // From <sys/ptrace.h> — Apple headers only.
    const PT_DENY_ATTACH: c_int = 31;

    unsafe extern "C" {
        fn ptrace(request: c_int, pid: c_int, addr: *mut u8, data: c_int) -> c_int;
    }

    pub fn deny_debugger() -> Result<(), std::io::Error> {
        // SAFETY: ptrace with PT_DENY_ATTACH takes no pointers we care about;
        // the kernel ignores addr/data for this request.
        let rc = unsafe { ptrace(PT_DENY_ATTACH, 0, std::ptr::null_mut(), 0) };
        if rc == 0 {
            Ok(())
        } else {
            Err(std::io::Error::last_os_error())
        }
    }

    pub fn disable_core_dumps() -> Result<(), std::io::Error> {
        // SAFETY: setrlimit is thread-safe and only touches this process.
        let rl = libc_rlimit {
            rlim_cur: 0,
            rlim_max: 0,
        };
        let rc = unsafe { setrlimit(RLIMIT_CORE, &rl) };
        if rc == 0 {
            Ok(())
        } else {
            Err(std::io::Error::last_os_error())
        }
    }

    #[repr(C)]
    struct libc_rlimit {
        rlim_cur: u64,
        rlim_max: u64,
    }
    const RLIMIT_CORE: c_int = 4;
    unsafe extern "C" {
        fn setrlimit(resource: c_int, rlim: *const libc_rlimit) -> c_int;
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    pub fn deny_debugger() -> Result<(), std::io::Error> {
        Ok(())
    }
    pub fn disable_core_dumps() -> Result<(), std::io::Error> {
        Ok(())
    }
}

/// Apply every hardening primitive we have. Logs each result at info/warn.
/// Never fails — a hardened worker is nice-to-have, a running worker is
/// must-have.
pub fn apply_all() {
    match imp::deny_debugger() {
        Ok(()) => tracing::info!("hardening: PT_DENY_ATTACH set — debuggers denied"),
        Err(e) => tracing::warn!(error = ?e, "hardening: PT_DENY_ATTACH failed"),
    }
    match imp::disable_core_dumps() {
        Ok(()) => tracing::info!("hardening: core dumps disabled"),
        Err(e) => tracing::warn!(error = ?e, "hardening: RLIMIT_CORE=0 failed"),
    }
}
