#!/usr/bin/env bash
set -euo pipefail

# Claw worker installer (v1 — ad-hoc signed, trust-but-verify).
# Production signing/notarization will replace this in v2 (see
# docs/worker-prerequisites.md).

API_URL="${CLAW_API_URL:-https://api.claw.dev}"
INSTALL_DIR="${CLAW_INSTALL_DIR:-$HOME/.claw}"
BIN_DIR="$INSTALL_DIR/bin"
# Binaries are published as GitHub Release assets, decoupled from the API host.
# Override with CLAW_RELEASES_BASE to pull from a self-hosted backend instead.
RELEASES_BASE="${CLAW_RELEASES_BASE:-https://github.com/rajagurunath/claw-compute/releases/latest/download}"

mkdir -p "$BIN_DIR"

ARCH="$(uname -m)"
OS="$(uname -s)"
if [[ "$OS" != "Darwin" || "$ARCH" != "arm64" ]]; then
    echo "ERROR: claw-worker v1 supports macOS / Apple Silicon only (got $OS/$ARCH)" >&2
    exit 1
fi

VERSION="${CLAW_WORKER_VERSION:-latest}"
TARBALL_URL="$RELEASES_BASE/claw-worker-$VERSION-aarch64-apple-darwin.tar.gz"
echo "→ Downloading $TARBALL_URL"
curl -fsSL "$TARBALL_URL" -o "$INSTALL_DIR/claw-worker.tar.gz"
tar -xzf "$INSTALL_DIR/claw-worker.tar.gz" -C "$BIN_DIR"
rm "$INSTALL_DIR/claw-worker.tar.gz"
chmod +x "$BIN_DIR/claw-worker"

# Verify ad-hoc signature is present (it's not Developer ID — see prerequisites doc).
if ! codesign --verify "$BIN_DIR/claw-worker" 2>/dev/null; then
    echo "WARN: binary not codesigned; macOS may quarantine it" >&2
fi

echo
echo "✔ Installed to $BIN_DIR/claw-worker"
echo
echo "Next steps:"
echo "  1. Get a provisioning token from your supplier dashboard"
echo "  2. Run:"
echo "       $BIN_DIR/claw-worker register \\"
echo "         --api-url $API_URL \\"
echo "         --provisioning-token <TOKEN>"
echo "  3. Run:"
echo "       $BIN_DIR/claw-worker run --api-url $API_URL"
echo
echo "Add $BIN_DIR to your PATH if you want to call it without the full path."
