#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="aarch64-apple-darwin"
VERSION="$(grep -m1 '^version' Cargo.toml | cut -d'"' -f2)"
OUT_DIR="../dist"
mkdir -p "$OUT_DIR"

cargo build --release --target "$TARGET"
./scripts/sign-adhoc.sh "target/$TARGET/release/claw-worker"

TARBALL="$OUT_DIR/claw-worker-$VERSION-$TARGET.tar.gz"
tar -czf "$TARBALL" -C "target/$TARGET/release" claw-worker
echo "✔ wrote $TARBALL"
