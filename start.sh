#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(pwd)"

go mod tidy

cd frontend
npm install
npm run build

cd "$ROOT_DIR"
go run .