#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
IMAGE_NAME="gigaclaw-agent"
TAG="${1:-latest}"
echo "Building GigaClaw agent container image with docker..."
echo "Image: ${IMAGE_NAME}:${TAG}"
docker build -t "${IMAGE_NAME}:${TAG}" .
echo ""
echo "Build complete!"
echo "Image: ${IMAGE_NAME}:${TAG}"
