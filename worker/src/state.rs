use std::path::Path;

use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{Connection, params};

/// Lock a file to owner-read/write only (0600). No-op on non-unix.
/// Best-effort — a failure just gets logged, we don't refuse to run.
fn lock_perms(path: &Path) {
    #[cfg(unix)]
    {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) = fs::set_permissions(path, fs::Permissions::from_mode(0o600)) {
            tracing::warn!(?path, error = ?e, "failed to chmod 0600");
        }
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
}

pub struct State {
    conn: Connection,
}

#[derive(Clone, Debug)]
pub struct BookingRow {
    pub id: String,
    pub offering_id: String,
    pub status: String,
    pub started_at: Option<DateTime<Utc>>,
    pub sandbox_id: Option<String>,
}

impl State {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        // Tighten perms before we write anything sensitive (booking metadata,
        // sandbox ids). Doesn't stop the same-UID operator; does stop other
        // users on the same Mac from reading it.
        lock_perms(path);
        // SQLite side-files inherit umask, so we lock them too if they've
        // been created (best-effort — silently skip if not present yet).
        for suffix in ["-wal", "-shm", "-journal"] {
            let mut side = path.as_os_str().to_owned();
            side.push(suffix);
            let side = std::path::PathBuf::from(side);
            if side.exists() {
                lock_perms(&side);
            }
        }
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                offering_id TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT,
                sandbox_id TEXT,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS kv (
                k TEXT PRIMARY KEY,
                v TEXT NOT NULL
            );
            "#,
        )?;
        Ok(Self { conn })
    }

    pub fn upsert_booking(&self, row: &BookingRow) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO bookings (id, offering_id, status, started_at, sandbox_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                started_at = excluded.started_at,
                sandbox_id = excluded.sandbox_id,
                updated_at = datetime('now')
            "#,
            params![
                row.id,
                row.offering_id,
                row.status,
                row.started_at.map(|t| t.to_rfc3339()),
                row.sandbox_id,
            ],
        )?;
        Ok(())
    }

    pub fn list_active_bookings(&self) -> Result<Vec<BookingRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, offering_id, status, started_at, sandbox_id FROM bookings WHERE status = 'active'",
        )?;
        let rows = stmt
            .query_map([], |r| {
                Ok(BookingRow {
                    id: r.get(0)?,
                    offering_id: r.get(1)?,
                    status: r.get(2)?,
                    started_at: r
                        .get::<_, Option<String>>(3)?
                        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                        .map(|d| d.with_timezone(&Utc)),
                    sandbox_id: r.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }
}
