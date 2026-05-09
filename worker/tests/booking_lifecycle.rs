use std::sync::Arc;

use claw_worker::api::ws::WorkerEvent;
use claw_worker::booking::BookingHandler;
use claw_worker::sandbox::{SandboxBackend, SandboxHandle, SandboxSpec};
use claw_worker::state::State;
use tokio::sync::Mutex;

struct RecordingBackend {
    started: Mutex<Vec<String>>,
    stopped: Mutex<Vec<String>>,
}

#[async_trait::async_trait]
impl SandboxBackend for RecordingBackend {
    fn name(&self) -> &'static str {
        "rec"
    }
    async fn start(&self, spec: SandboxSpec) -> anyhow::Result<SandboxHandle> {
        self.started.lock().await.push(spec.booking_id.clone());
        Ok(SandboxHandle {
            sandbox_id: format!("sb-{}", spec.booking_id),
            forwarded_port: None,
        })
    }
    async fn stop(&self, sandbox_id: &str) -> anyhow::Result<()> {
        self.stopped.lock().await.push(sandbox_id.into());
        Ok(())
    }
    async fn is_running(&self, _: &str) -> anyhow::Result<bool> {
        Ok(true)
    }
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
        .dispatch(WorkerEvent::BookingCancelled {
            booking_id: "b1".into(),
        })
        .await
        .unwrap();

    assert_eq!(
        backend.started.lock().await.as_slice(),
        &["b1".to_string()]
    );
    assert_eq!(
        backend.stopped.lock().await.as_slice(),
        &["sb-b1".to_string()]
    );
}

#[tokio::test]
async fn cancel_unknown_booking_is_noop() {
    let dir = tempfile::tempdir().unwrap();
    let backend = Arc::new(RecordingBackend {
        started: Mutex::new(vec![]),
        stopped: Mutex::new(vec![]),
    });
    let state = Arc::new(Mutex::new(State::open(&dir.path().join("s.db")).unwrap()));
    let handler = BookingHandler::new(backend.clone(), state.clone());

    handler
        .dispatch(WorkerEvent::BookingCancelled {
            booking_id: "never-booked".into(),
        })
        .await
        .unwrap();

    assert!(backend.stopped.lock().await.is_empty());
}

#[tokio::test]
async fn ping_event_is_a_noop() {
    let dir = tempfile::tempdir().unwrap();
    let backend = Arc::new(RecordingBackend {
        started: Mutex::new(vec![]),
        stopped: Mutex::new(vec![]),
    });
    let state = Arc::new(Mutex::new(State::open(&dir.path().join("s.db")).unwrap()));
    let handler = BookingHandler::new(backend.clone(), state.clone());

    handler.dispatch(WorkerEvent::Ping).await.unwrap();

    assert!(backend.started.lock().await.is_empty());
    assert!(backend.stopped.lock().await.is_empty());
}
