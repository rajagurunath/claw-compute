//! Runs only when `RUN_CONTAINER_SMOKE=1` is set. Requires Apple `container`
//! daemon and the `claw/agent-base:latest` image already built locally.
//! Run with: `RUN_CONTAINER_SMOKE=1 cargo test --test container_smoke -- --nocapture`.
use claw_worker::sandbox::container::ContainerBackend;
use claw_worker::sandbox::{SandboxBackend, SandboxSpec};

fn enabled() -> bool {
    std::env::var("RUN_CONTAINER_SMOKE").as_deref() == Ok("1")
}

#[tokio::test]
async fn start_and_stop_real_container() {
    if !enabled() {
        eprintln!("skipping (set RUN_CONTAINER_SMOKE=1 to run)");
        return;
    }
    let backend = ContainerBackend::detect().expect("apple `container` not on PATH");
    let spec = SandboxSpec {
        booking_id: "smoke1".into(),
        offering_id: "o".into(),
        image: "claw/agent-base:latest".into(),
        cpu_limit: Some(1),
        memory_limit_mb: Some(2048),
        agent_config: serde_json::Value::Null,
    };
    let handle = backend.start(spec).await.expect("start failed");
    assert!(!handle.sandbox_id.is_empty());
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    let running = backend
        .is_running(&handle.sandbox_id)
        .await
        .expect("is_running failed");
    assert!(running, "expected sandbox to be running");
    backend
        .stop(&handle.sandbox_id)
        .await
        .expect("stop failed");
}
