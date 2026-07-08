//! End-to-end test for the consumer→sandbox→assistant relay path.
//!
//! Stands up two wiremock servers — one impersonating the agent runtime
//! at the sandbox port, one impersonating the marketplace's
//! `/v1/bookings/{id}/messages/internal` endpoint — and verifies that a
//! `MessageUser` event causes BookingHandler to:
//!   1. POST the message to the sandbox chat endpoint, and
//!   2. POST the assistant reply back to the marketplace internal endpoint
//!      with the worker JWT.
use std::net::TcpListener;
use std::sync::Arc;

use claw_worker::api::client::ApiClient;
use claw_worker::api::ws::WorkerEvent;
use claw_worker::booking::BookingHandler;
use claw_worker::sandbox::{SandboxBackend, SandboxHandle, SandboxSpec};
use claw_worker::state::State;
use serde_json::json;
use tokio::sync::Mutex;
use wiremock::matchers::{body_partial_json, header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

struct PortBackend {
    port: u16,
}

#[async_trait::async_trait]
impl SandboxBackend for PortBackend {
    fn name(&self) -> &'static str {
        "port"
    }
    async fn start(&self, spec: SandboxSpec) -> anyhow::Result<SandboxHandle> {
        Ok(SandboxHandle {
            sandbox_id: format!("sb-{}", spec.booking_id),
            forwarded_port: Some(self.port),
        })
    }
    async fn stop(&self, _: &str) -> anyhow::Result<()> {
        Ok(())
    }
    async fn is_running(&self, _: &str) -> anyhow::Result<bool> {
        Ok(true)
    }
}

/// Bind a fresh free port (and immediately drop the listener so the port
/// is released for the wiremock server to grab).
fn pick_port() -> u16 {
    let l = TcpListener::bind("127.0.0.1:0").unwrap();
    l.local_addr().unwrap().port()
}

#[tokio::test]
async fn relay_round_trip() {
    // 1. Sandbox HTTP server on a known free port (mirrors what the
    //    SandboxBackend would forward to inside the VM).
    let sandbox_port = pick_port();
    let sandbox = MockServer::builder()
        .listener(TcpListener::bind(("127.0.0.1", sandbox_port)).unwrap())
        .start()
        .await;
    Mock::given(method("POST"))
        .and(path("/v1/chat/completions"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "choices": [{
                "message": {"role": "assistant", "content": "hello back"}
            }]
        })))
        .mount(&sandbox)
        .await;

    // 2. Marketplace API mock for /v1/bookings/{id}/messages/internal,
    //    asserting Bearer auth header + JSON body.
    let api_server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/v1/bookings/b1/messages/internal"))
        .and(header("authorization", "Bearer wjwt.test"))
        .and(body_partial_json(json!({"content": "hello back"})))
        .respond_with(ResponseTemplate::new(201).set_body_json(json!({
            "id": "msg1",
            "role": "assistant",
            "content": "hello back",
            "created_at": "2026-05-10T00:00:00Z"
        })))
        .expect(1)
        .mount(&api_server)
        .await;

    let api = Arc::new(ApiClient::new(api_server.uri()).unwrap());
    let backend: Arc<dyn SandboxBackend> = Arc::new(PortBackend { port: sandbox_port });
    let dir = tempfile::tempdir().unwrap();
    let state = Arc::new(Mutex::new(State::open(&dir.path().join("s.db")).unwrap()));
    let handler = BookingHandler::new(backend, state).with_api_client(api, "wjwt.test".into());

    // 3. Activate a booking — installs the sandbox port mapping.
    handler
        .dispatch(WorkerEvent::BookingActivated {
            booking_id: "b1".into(),
            offering_id: "o1".into(),
            agent_config: serde_json::Value::Null,
        })
        .await
        .unwrap();

    // 4. Receive a user message — should hit sandbox + marketplace.
    handler
        .dispatch(WorkerEvent::MessageUser {
            booking_id: "b1".into(),
            content: "hi agent".into(),
        })
        .await
        .unwrap();

    // wiremock verifies on drop that .expect(1) matched.
}

#[tokio::test]
async fn relay_without_wiring_logs_only() {
    // No api client + no port mapping: handler logs and returns Ok.
    let dir = tempfile::tempdir().unwrap();
    let state = Arc::new(Mutex::new(State::open(&dir.path().join("s.db")).unwrap()));
    let backend: Arc<dyn SandboxBackend> = Arc::new(PortBackend { port: 0 });
    let handler = BookingHandler::new(backend, state);

    handler
        .dispatch(WorkerEvent::MessageUser {
            booking_id: "no-such-booking".into(),
            content: "hi".into(),
        })
        .await
        .unwrap();
}
