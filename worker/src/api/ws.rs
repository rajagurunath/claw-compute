use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::time::{Duration, sleep};
use tokio_tungstenite::tungstenite::{Message, client::IntoClientRequest};

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkerEvent {
    Ping,
    BookingActivated {
        booking_id: String,
        offering_id: String,
        agent_config: serde_json::Value,
    },
    BookingCancelled {
        booking_id: String,
    },
    /// Consumer chat message relayed by marketplace from POST /v1/bookings/{id}/messages.
    MessageUser {
        booking_id: String,
        content: String,
    },
}

pub async fn run_ws<F, Fut>(
    api_url: &str,
    worker_token: &str,
    mut on_event: F,
) -> Result<()>
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
        let mut req = ws_url
            .as_str()
            .into_client_request()
            .context("bad ws url")?;
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
                        Ok(Message::Text(text)) => match serde_json::from_str::<WorkerEvent>(&text)
                        {
                            Ok(WorkerEvent::Ping) => {
                                let _ = stream.send(Message::Pong(vec![].into())).await;
                            }
                            Ok(ev) => {
                                if let Err(e) = on_event(ev).await {
                                    tracing::warn!(error = ?e, "event handler failed");
                                }
                            }
                            Err(e) => {
                                tracing::warn!(error = ?e, payload = %text, "bad ws frame")
                            }
                        },
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
