//! End-to-end sealing test.
//!
//! Runs the Python `seal_for_worker` (via `uv run`) against a freshly-generated
//! X25519 keypair, then decrypts with the same crypto_box primitives the WS
//! layer uses (`crypto_box::SalsaBox`). If plaintext round-trips, the two
//! sides agree on the wire format.
//!
//! Requires: `uv` on PATH and the backend deps installed (`cd backend && uv sync`).
//! Skips itself silently otherwise.

use std::process::Command;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use claw_worker::api::ws::{SealedEnvelope, WorkerEvent};
use crypto_box::{PublicKey, SalsaBox, SecretKey, aead::Aead};

fn backend_dir() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("backend")
}

fn can_run() -> bool {
    Command::new("uv").arg("--version").output().is_ok()
        && backend_dir().join("pyproject.toml").exists()
}

fn open_with(env: &SealedEnvelope, sk: &SecretKey) -> Result<WorkerEvent, String> {
    let nonce = B64.decode(&env.nonce).map_err(|e| e.to_string())?;
    let eph = B64.decode(&env.ephemeral_pubkey).map_err(|e| e.to_string())?;
    let ct = B64.decode(&env.ciphertext).map_err(|e| e.to_string())?;
    let eph_arr: [u8; 32] = eph.try_into().map_err(|_| "eph pubkey wrong len".to_string())?;
    let sender = PublicKey::from(eph_arr);
    let boxx = SalsaBox::new(&sender, sk);
    let pt = boxx
        .decrypt(crypto_box::Nonce::from_slice(&nonce), ct.as_slice())
        .map_err(|_| "decrypt failed".to_string())?;
    serde_json::from_slice(&pt).map_err(|e| e.to_string())
}

#[test]
fn python_seal_rust_open() {
    if !can_run() {
        eprintln!("skipping: uv or backend/pyproject.toml missing");
        return;
    }
    let sk = SecretKey::generate(&mut rand::thread_rng());
    let pk_b64 = B64.encode(sk.public_key().as_bytes());

    let script = "\
import json, sys
from claw_api.crypto.sealer import seal_for_worker
env = seal_for_worker(
    sys.argv[1],
    'message_user',
    {'booking_id': 'bkg-1', 'content': 'hello, sealed'},
)
print(json.dumps(env))
";
    let out = Command::new("uv")
        .args(["run", "python", "-c", script, &pk_b64])
        .current_dir(backend_dir())
        .output()
        .expect("uv run python failed");
    assert!(
        out.status.success(),
        "python sealer failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let env: SealedEnvelope =
        serde_json::from_slice(&out.stdout).expect("sealed envelope not valid JSON");

    // Positive path: right key opens it.
    let inner = open_with(&env, &sk).expect("decrypt with correct key");
    match inner {
        WorkerEvent::MessageUser {
            booking_id,
            content,
        } => {
            assert_eq!(booking_id, "bkg-1");
            assert_eq!(content, "hello, sealed");
        }
        other => panic!("unexpected inner event: {other:?}"),
    }

    // Negative path: a different key must fail.
    let bogus = SecretKey::generate(&mut rand::thread_rng());
    assert!(open_with(&env, &bogus).is_err(), "bogus key should not decrypt");
}
