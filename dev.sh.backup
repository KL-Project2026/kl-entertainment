#!/usr/bin/env bash
# MIGRATION: 로컬 다중 서비스 동시 기동 (Replit 후속 환경)
set -euo pipefail

API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-5173}"

echo "KL Project local dev"
echo "   API:  http://localhost:${API_PORT}"
echo "   Web:  http://localhost:${WEB_PORT}"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# API 서버
(cd artifacts/api-server && PORT="${API_PORT}" pnpm dev) &
API_PID=$!

# Web App
(cd artifacts/web-app && PORT="${WEB_PORT}" BASE_PATH="/" pnpm dev) &
WEB_PID=$!

cleanup() {
  echo ""
  echo "Stopping all services..."
  kill "${API_PID}" "${WEB_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
