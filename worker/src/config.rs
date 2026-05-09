use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "io.claw.worker";
const KEYRING_USER: &str = "worker_token";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Config {
    pub api_url: String,
    pub heartbeat_interval_secs: u64,
}

impl Config {
    pub fn data_dir() -> Result<PathBuf> {
        let base = dirs::data_dir().context("no data dir for current platform")?;
        let dir = base.join("claw-worker");
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    pub fn db_path() -> Result<PathBuf> {
        Ok(Self::data_dir()?.join("state.db"))
    }

    pub fn store_worker_token(token: &str) -> Result<()> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        entry.set_password(token)?;
        Ok(())
    }

    pub fn load_worker_token() -> Result<Option<String>> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        match entry.get_password() {
            Ok(t) => Ok(Some(t)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn delete_worker_token() -> Result<()> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.into()),
        }
    }
}
