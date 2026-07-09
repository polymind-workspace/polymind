#!/usr/bin/env bash
set -e

# Start PolyMind web + admin + API + Python workers for local development.

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

# 1. Start web frontend
pnpm --filter web dev &

# 2. Start admin frontend
pnpm --filter admin dev &

# 3. Start API (with Alembic migrations)
cd apps/api
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8300 &

# 4. Start Python workers.
#    These mirror the old api/scripts/ cron architecture. The main indexer
#    needs SOLANA_PROGRAM_ID; the others idle gracefully when unconfigured.
if [ -n "${SOLANA_PROGRAM_ID:-}" ]; then
  echo "Starting PolyMind indexer for program: $SOLANA_PROGRAM_ID"
  uv run python -m app.workers.indexer &
else
  echo "SOLANA_PROGRAM_ID not set, skipping app.workers.indexer."
  echo "Deploy the Anchor program and add SOLANA_PROGRAM_ID to your .env to enable it."
fi

echo "Starting Champion indexer..."
uv run python -m app.workers.champion_indexer &

echo "Starting notification worker..."
uv run python -m app.workers.notification_worker &

echo "Starting deadline cron..."
uv run python -m app.workers.deadline_cron &

echo "Starting referral reward worker..."
uv run python -m app.workers.referral_reward_worker &

cd ../..

wait
