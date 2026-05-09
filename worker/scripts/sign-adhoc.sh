#!/usr/bin/env bash
set -euo pipefail
BIN="${1:?usage: sign-adhoc.sh <binary>}"
codesign --force --sign - "$BIN"
codesign --verify --verbose=2 "$BIN"
echo "✔ ad-hoc signed: $BIN"
echo "NOTE: ad-hoc signing works only on the local machine. For distribution,"
echo "      see docs/worker-prerequisites.md for Developer ID + notarization."
