#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

IMAGE_NAME="${IMAGE_NAME:-claw/agent-base}"
VERSION="$(grep -m1 '^version' pyproject.toml | cut -d'"' -f2)"
TAG="$VERSION"

# Apple `container` if available (macOS 26+), else docker (Lima fallback or
# native Docker Desktop).
if command -v container >/dev/null 2>&1; then
    BUILDER=container
else
    BUILDER=docker
fi

# Reuse: skip rebuild if the version-tagged image already exists locally.
if "$BUILDER" image inspect "$IMAGE_NAME:$TAG" >/dev/null 2>&1; then
    echo "✔ $IMAGE_NAME:$TAG already present locally — skipping rebuild"
    "$BUILDER" image inspect "$IMAGE_NAME:$TAG" --format '{{.Id}} {{.RepoTags}}'
    # Make sure :latest also points at it.
    "$BUILDER" tag "$IMAGE_NAME:$TAG" "$IMAGE_NAME:latest"
    exit 0
fi

echo "→ Building $IMAGE_NAME:$TAG with $BUILDER"
"$BUILDER" build -t "$IMAGE_NAME:$TAG" -t "$IMAGE_NAME:latest" .
"$BUILDER" images "$IMAGE_NAME"
