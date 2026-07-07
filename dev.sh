#!/usr/bin/env bash
set -e

# Start PolyMind web + API for local development.

cd "$(dirname "$0")"

cleanup() {
  echo ""
  echo "Shutting down dev servers..."
  kill 0 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

pnpm --filter web dev &

cd apps/api
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8300 &

wait
