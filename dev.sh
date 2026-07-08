#!/usr/bin/env bash
set -e

# Start PolyMind web + API (+ Solana indexer if configured) for local development.

cd "$(dirname "$0")"

# Load environment variables from root .env if present.
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . .env
  set +a
fi

cleanup() {
  echo ""
  echo "Shutting down dev servers..."
  kill 0 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start frontend
pnpm --filter web dev &

# 2. Start API (with Alembic migrations)
cd apps/api
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8300 &
cd ../..

# 3. Start Solana indexer if a program id is configured.
if [ -n "${SOLANA_PROGRAM_ID:-}" ]; then
  echo "Starting Solana indexer for program: $SOLANA_PROGRAM_ID"
  cd solana/indexer
  cargo run &
  cd ../..
else
  echo "SOLANA_PROGRAM_ID not set, skipping Solana indexer."
  echo "Deploy the Anchor program and add SOLANA_PROGRAM_ID to your .env to enable it."
fi

wait
