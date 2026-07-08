//! Redacting formatter for `tracing`.
//!
//! Rewrites the *values* of a small set of field names (`content`, `prompt`,
//! `agent_config`, `ciphertext`, `plaintext`, `sk`, `secret`, `pubkey_x25519`
//! stays visible) with `<redacted:N bytes>` before they hit stdout.
//!
//! This is a defense-in-depth guard: today no code path logs decrypted
//! prompts, but a future `tracing::debug!(content = %msg, …)` slipping in
//! shouldn't be able to leak the plaintext. The redactor is installed at
//! process start; nothing in the code is expected to bypass it.
//!
//! Note: this ONLY protects our own tracing pipeline. Anything a subprocess
//! (e.g. `mlx_lm.server`) prints to its own stdout is outside our reach.

use std::fmt::{self, Write as _};

use tracing::field::{Field, Visit};
use tracing_subscriber::field::RecordFields;
use tracing_subscriber::fmt::format::{FormatFields, Writer};

/// Field names whose values must never appear in logs.
const DENY: &[&str] = &[
    "content",
    "prompt",
    "agent_config",
    "ciphertext",
    "plaintext",
    "sk",
    "secret",
    "secret_key",
    "worker_token",
    "provisioning_token",
];

/// Drop-in replacement for the default `DefaultFields` formatter.
pub struct RedactingFields;

impl<'writer> FormatFields<'writer> for RedactingFields {
    fn format_fields<R: RecordFields>(&self, writer: Writer<'writer>, fields: R) -> fmt::Result {
        let mut v = RedactingVisitor {
            writer,
            first: true,
            err: Ok(()),
        };
        fields.record(&mut v);
        v.err
    }
}

struct RedactingVisitor<'a> {
    writer: Writer<'a>,
    first: bool,
    err: fmt::Result,
}

impl<'a> RedactingVisitor<'a> {
    fn write_field(&mut self, field: &Field, value: &str) {
        if self.err.is_err() {
            return;
        }
        let name = field.name();
        let sep = if self.first { "" } else { " " };
        self.first = false;
        let display = if DENY.contains(&name) {
            format!("<redacted:{} bytes>", value.len())
        } else {
            value.to_string()
        };
        self.err = write!(self.writer, "{sep}{name}={display}");
    }
}

impl<'a> Visit for RedactingVisitor<'a> {
    fn record_str(&mut self, field: &Field, value: &str) {
        self.write_field(field, value);
    }

    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        let mut buf = String::new();
        let _ = write!(&mut buf, "{value:?}");
        self.write_field(field, &buf);
    }

    fn record_i64(&mut self, field: &Field, value: i64) {
        self.write_field(field, &value.to_string());
    }

    fn record_u64(&mut self, field: &Field, value: u64) {
        self.write_field(field, &value.to_string());
    }

    fn record_bool(&mut self, field: &Field, value: bool) {
        self.write_field(field, &value.to_string());
    }

    fn record_f64(&mut self, field: &Field, value: f64) {
        self.write_field(field, &value.to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tracing_subscriber::fmt;

    #[test]
    fn redacts_known_field() {
        let out = capture(|| {
            tracing::info!(content = "top-secret-prompt", other = "visible");
        });
        assert!(
            out.contains("content=<redacted:"),
            "expected redaction, got: {out}"
        );
        assert!(
            !out.contains("top-secret-prompt"),
            "leaked plaintext: {out}"
        );
        assert!(
            out.contains("other=visible"),
            "non-secret field lost: {out}"
        );
    }

    #[test]
    fn passes_through_non_denied() {
        let out = capture(|| {
            tracing::info!(booking_id = "bkg-1", offering_id = "ofr-2");
        });
        assert!(out.contains("booking_id=bkg-1"), "got: {out}");
        assert!(out.contains("offering_id=ofr-2"), "got: {out}");
    }

    fn capture(f: impl FnOnce()) -> String {
        use std::io;
        use std::sync::{Arc, Mutex};
        let buf = Arc::new(Mutex::new(Vec::<u8>::new()));
        struct SharedWriter(Arc<Mutex<Vec<u8>>>);
        impl io::Write for SharedWriter {
            fn write(&mut self, b: &[u8]) -> io::Result<usize> {
                self.0.lock().unwrap().extend_from_slice(b);
                Ok(b.len())
            }
            fn flush(&mut self) -> io::Result<()> {
                Ok(())
            }
        }
        let make = {
            let buf = buf.clone();
            move || SharedWriter(buf.clone())
        };
        let sub = fmt()
            .fmt_fields(RedactingFields)
            .with_writer(make)
            .with_ansi(false)
            .finish();
        tracing::subscriber::with_default(sub, f);
        String::from_utf8(buf.lock().unwrap().clone()).unwrap()
    }
}
