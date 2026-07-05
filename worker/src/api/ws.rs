use anyhow::{Context, Result, anyhow};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use crypto_box::{PublicKey, SalsaBox, SecretKey, aead::Aead};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::time::{Duration, sleep};
use tokio_tungstenite::tungstenite::{Message, client::IntoClientRequest};

use crate::attestation::Identity;

/// Sealed envelope produced by the backend. Payload is a `crypto_box`
/// ciphertext of a JSON blob whose shape depends on `inner_type`.
#[derive(Clone, Debug, Deserialize)]
pub struct SealedEnvelope {
    /// The inner event type once decrypted — for routing before we spend
    /// crypto (e.g. drop unknown types early).
    pub inner_type: String,
    /// base64(24-byte nonce)
    pub nonce: String,
    /// base64(ephemeral sender public key, 32 bytes)
    pub ephemeral_pubkey: String,
    /// base64(ciphertext)
    pub ciphertext: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkerEvent {
    Ping,
    BookingActivated {
        booking_id: String,
        offering_id: String,
        #[serde(default)]
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
    /// Encrypted variant — payload is a NaCl Box sealed to the worker's
    /// registered X25519 public key. Everything sensitive (prompts,
    /// agent configs) ships via this variant once the backend is on the
    /// sealed rollout path.
    Sealed(SealedEnvelope),
}

/// Decrypt a sealed envelope and re-parse it as a plaintext `WorkerEvent`.
pub fn open_sealed(env: &SealedEnvelope, identity: &Identity) -> Result<WorkerEvent> {
    let nonce = B64
        .decode(env.nonce.as_bytes())
        .context("sealed: nonce not base64")?;
    if nonce.len() != 24 {
        return Err(anyhow!("sealed: nonce wrong length: {}", nonce.len()));
    }
    let eph_bytes = B64
        .decode(env.ephemeral_pubkey.as_bytes())
        .context("sealed: ephemeral_pubkey not base64")?;
    if eph_bytes.len() != 32 {
        return Err(anyhow!("sealed: ephemeral_pubkey wrong length"));
    }
    let ct = B64
        .decode(env.ciphertext.as_bytes())
        .context("sealed: ciphertext not base64")?;

    let eph_arr: [u8; 32] = eph_bytes.try_into().unwrap();
    let sender = PublicKey::from(eph_arr);
    let sk: &SecretKey = identity.secret();
    let boxx = SalsaBox::new(&sender, sk);
    let nonce_arr = crypto_box::Nonce::from_slice(&nonce);
    let pt = boxx
        .decrypt(nonce_arr, ct.as_slice())
        .map_err(|_| anyhow!("sealed: crypto_box decrypt failed"))?;

    // Inner is a JSON WorkerEvent (with `type` = env.inner_type). We re-run it
    // through serde so the same enum branches handle it.
    let ev: WorkerEvent =
        serde_json::from_slice(&pt).context("sealed: inner payload not a WorkerEvent")?;
    // Refuse recursive Sealed — never trust the sender to tell us to loop.
    if matches!(ev, WorkerEvent::Sealed(_)) {
        return Err(anyhow!("sealed: refuses to nest"));
    }
    Ok(ev)
}

pub async fn run_ws<F, Fut>(
    api_url: &str,
    worker_token: &str,
    identity: Identity,
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
                            Ok(WorkerEvent::Sealed(env)) => match open_sealed(&env, &identity) {
                                Ok(inner) => {
                                    if let Err(e) = on_event(inner).await {
                                        tracing::warn!(error = ?e, "sealed event handler failed");
                                    }
                                }
                                Err(e) => {
                                    tracing::warn!(error = ?e, inner_type = %env.inner_type, "unseal failed")
                                }
                            },
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
