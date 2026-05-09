#!/usr/bin/env bash
# Installs the dependencies the worker host needs for inference + sandboxing.
# Idempotent: re-running is safe.
set -euo pipefail

OS="$(uname -s)"
ARCH="$(uname -m)"
if [[ "$OS" != "Darwin" || "$ARCH" != "arm64" ]]; then
    echo "ERROR: claw-worker host bootstrap supports macOS / Apple Silicon only." >&2
    exit 1
fi

echo "→ Checking macOS version"
MACOS_VER="$(sw_vers -productVersion | cut -d. -f1)"
USE_APPLE_CONTAINER=0
if [[ "$MACOS_VER" -ge 26 ]]; then
    USE_APPLE_CONTAINER=1
fi

echo "→ Installing uv (used to launch mlx-lm)"
if ! command -v uv >/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi
uv --version

if [[ "$USE_APPLE_CONTAINER" -eq 1 ]]; then
    echo "→ Apple container framework"
    if ! command -v container >/dev/null 2>&1; then
        cat <<EOF >&2
ERROR: Apple 'container' is not on PATH.
Install the latest release from https://github.com/apple/container/releases/latest
then re-run this script.
EOF
        exit 1
    fi
    container --version
else
    echo "→ macOS < 26 detected — installing Lima fallback"
    if ! command -v limactl >/dev/null 2>&1; then
        if ! command -v brew >/dev/null 2>&1; then
            cat <<EOF >&2
ERROR: Homebrew is required to install Lima.
Install from https://brew.sh, then re-run this script.
EOF
            exit 1
        fi
        brew install lima
    fi
    limactl --version
fi

echo "→ Installing mlx-lm via uv (downloads ~200MB on first run)"
uv tool install --upgrade mlx-lm

echo
echo "✔ Host dependencies ready."
echo "  Sandbox runtime: $([ $USE_APPLE_CONTAINER -eq 1 ] && echo 'Apple container' || echo 'Lima')"
echo "  Inference:       mlx-lm via 'uv tool run mlx_lm.server …'"
echo
echo "Next:"
echo "  1. Add a worker from your supplier dashboard."
echo "  2. Run the install + register snippets it gives you."
