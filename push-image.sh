#!/bin/sh

set -e

IMAGE="opensmartfridge/server:latest"

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "$IMAGE" \
  --push \
  .

echo "Image $IMAGE erfolgreich gebaut und gepusht."
