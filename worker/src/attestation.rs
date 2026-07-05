//! Worker cryptographic identity.
//!
//! Each worker owns a long-lived X25519 keypair. The private half is stored
//! in the macOS Keychain (Login keychain, ACL-scoped to this bundle id when
//! codesigned; ad-hoc-signed binaries share the file-based fallback that
//! `keyring-rs` uses). The public half is registered with the coordinator
//! so it can seal per-request payloads to this worker with NaCl Box
//! (X25519 + XSalsa20-Poly1305).
//!
//! Threat model: an operator with root **cannot** dump the private key from
//! process memory if `PT_DENY_ATTACH` succeeded (see `hardening.rs`). They
//! *can* still read the Keychain entry from the same UID — full protection
//! there requires the Secure Enclave path (Phase 2).

use anyhow::{Context, Result};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use crypto_box::{PublicKey, SecretKey, aead::OsRng};
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "io.claw.worker";
const KEYRING_USER: &str = "attestation_key_v1";

/// The worker's long-lived X25519 identity.
#[derive(Clone)]
pub struct Identity {
    secret: SecretKey,
    public: PublicKey,
}

/// Wire form for the public half.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PublicIdentity {
    /// base64(x25519 public key, 32 bytes)
    pub pubkey_x25519: String,
}

impl Identity {
    /// Load from Keychain or generate + persist a fresh keypair.
    pub fn load_or_create() -> Result<Self> {
        if let Some(sk) = read_keychain()? {
            let public = sk.public_key();
            return Ok(Self { secret: sk, public });
        }
        let secret = SecretKey::generate(&mut OsRng);
        let public = secret.public_key();
        write_keychain(&secret)?;
        Ok(Self { secret, public })
    }

    pub fn public(&self) -> PublicIdentity {
        PublicIdentity {
            pubkey_x25519: B64.encode(self.public.as_bytes()),
        }
    }

    pub fn secret(&self) -> &SecretKey {
        &self.secret
    }
}

fn read_keychain() -> Result<Option<SecretKey>> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    match entry.get_password() {
        Ok(b64) => {
            let raw = B64.decode(b64.as_bytes()).context("keychain sk not base64")?;
            if raw.len() != 32 {
                anyhow::bail!("keychain sk wrong length: {}", raw.len());
            }
            let arr: [u8; 32] = raw.try_into().unwrap();
            Ok(Some(SecretKey::from(arr)))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

fn write_keychain(sk: &SecretKey) -> Result<()> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    entry.set_password(&B64.encode(sk.to_bytes()))?;
    Ok(())
}
