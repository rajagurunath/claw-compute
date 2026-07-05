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
        .register("provtoken", serde_json::json!({"chip": "Apple M3 Max"}), None)
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
    let result = client.register("bad", serde_json::Value::Null, None).await;
    assert!(result.is_err());
}
