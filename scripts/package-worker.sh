#!/usr/bin/env bash
set -euo pipefail

# Package the built claw-worker binary into the release tarball that the
# backend serves at /releases/... and the installer downloads.
#
#   scripts/package-worker.sh            # use an existing build, else `cargo build`
#   scripts/package-worker.sh release    # force a --release build first
#
# Output: worker/dist/claw-worker-<version>-aarch64-apple-darwin.tar.gz

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER="$ROOT/worker"
DIST="$WORKER/dist"
VERSION="${CLAW_WORKER_VERSION:-latest}"
PROFILE="${1:-}"

if [[ "$PROFILE" == "release" ]]; then
    echo "→ Building claw-worker (release, aarch64-apple-darwin)"
    (cd "$WORKER" && cargo build --release --target aarch64-apple-darwin)
fi

# Find the binary — prefer the targeted release build (what `make worker-build`
# produces), then a plain release, then debug. Build debug if nothing exists.
CANDIDATES=(
    "$WORKER/target/aarch64-apple-darwin/release/claw-worker"
    "$WORKER/target/release/claw-worker"
    "$WORKER/target/debug/claw-worker"
)
BIN=""
for c in "${CANDIDATES[@]}"; do
    if [[ -x "$c" ]]; then BIN="$c"; break; fi
done
if [[ -z "$BIN" ]]; then
    echo "→ No build found; building claw-worker (debug)"
    (cd "$WORKER" && cargo build)
    BIN="$WORKER/target/debug/claw-worker"
fi

mkdir -p "$DIST"
TARBALL="$DIST/claw-worker-$VERSION-aarch64-apple-darwin.tar.gz"
tar -czf "$TARBALL" -C "$(dirname "$BIN")" "$(basename "$BIN")"

echo "✔ packaged $(basename "$BIN") → $TARBALL"
echo "  ($(du -h "$TARBALL" | cut -f1), served at \${API}/releases/$(basename "$TARBALL"))"
