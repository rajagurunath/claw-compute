#!/usr/bin/env bash
# End-to-end test: Python `seal_for_worker` -> Rust `open_sealed` -> plaintext.
# Proves that backend and worker agree on the NaCl Box wire format.
#
# The actual cross-language work lives in worker/tests/sealing_roundtrip.rs,
# which shells out to the backend's Python sealer via `uv run`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/worker" && cargo test --quiet --test sealing_roundtrip -- --nocapture
