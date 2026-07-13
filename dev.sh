#!/usr/bin/env bash
set -e

# Start PolyMind web + admin + API + Python workers for local development.
# Usage: ./dev.sh [local|dev]
#   local  - use solana-test-validator on localhost:8899 (default)
#   dev    - use Solana devnet (requires internet access)

MODE="${1:-local}"

if [ "$MODE" != "local" ] && [ "$MODE" != "dev" ]; then
  echo "Usage: $0 [local|dev]"
  echo "  local  - localnet (solana-test-validator), default"
  echo "  dev    - Solana devnet"
  exit 1
fi

cd "$(dirname "$0")"

# Load base environment variables from root .env.
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . .env
  set +a
fi

PROGRAM_ID="${SOLANA_PROGRAM_ID:-GRzZ7B6ZzgU2TuvmTFhtPHbc98CScGLw6h5McTM4SXT5}"

if [ "$MODE" = "local" ]; then
  echo "==> Using Solana localnet"

  # Override Solana network env vars for localnet.
  # Vite and pydantic-settings both respect existing environment variables
  # over values read from .env files.
  export VITE_SOLANA_CLUSTER=localnet
  export VITE_SOLANA_RPC=http://localhost:8899
  export VITE_SOLANA_WS=ws://localhost:8900
  export SOLANA_CLUSTER=localnet
  export SOLANA_RPC_URL=http://localhost:8899

  # Start solana-test-validator if not already running.
  if ! curl -s -X POST -H "Content-Type: application/json" \
       -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
       http://localhost:8899/ | grep -q '"result"\s*:\s*"ok"'; then
    echo "==> Starting solana-test-validator..."
    solana-test-validator --reset > /tmp/solana-test-validator.log 2>&1 &
    VALIDATOR_PID=$!
    echo "validator pid: $VALIDATOR_PID"

    for _ in $(seq 1 30); do
      if curl -s -X POST -H "Content-Type: application/json" \
         -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
         http://localhost:8899/ | grep -q '"result"\s*:\s*"ok"'; then
        break
      fi
      sleep 1
    done
  else
    echo "==> solana-test-validator already running"
  fi

  # Deploy the polymind program if it is not already on localnet.
  if ! solana program show "$PROGRAM_ID" -u localhost >/dev/null 2>&1; then
    echo "==> Deploying polymind program to localnet..."
    (
      cd solana/programs/polymind
      anchor deploy --provider.cluster localnet
    )
  else
    echo "==> polymind program already deployed on localnet"
  fi
else
  echo "==> Using Solana devnet"
  if ! solana program show "$PROGRAM_ID" -u devnet >/dev/null 2>&1; then
    echo "WARNING: polymind program not found on devnet."
    echo "If devnet is unreachable, switch to local mode: ./dev.sh local"
  fi
fi

cleanup() {
  echo ""
  echo "Shutting down dev servers..."
  kill 0 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

# Start PostgreSQL via Docker Compose if not already running.
if ! docker compose -f apps/api/docker-compose.yml ps db | grep -q "running"; then
  echo "==> Starting PostgreSQL..."
  docker compose -f apps/api/docker-compose.yml up -d db
fi

# 1. Start web frontend
pnpm --filter web dev &

# 2. Start admin frontend
pnpm --filter admin dev &

# 3. Start API (with Alembic migrations)
cd apps/api
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8300 &

# 4. Start Python workers.
if [ -n "${SOLANA_PROGRAM_ID:-}" ]; then
  echo "==> Starting PolyMind indexer for program: $SOLANA_PROGRAM_ID"
  uv run python -m app.workers.indexer &
else
  echo "SOLANA_PROGRAM_ID not set, skipping app.workers.indexer."
  echo "Deploy the Anchor program and add SOLANA_PROGRAM_ID to your .env to enable it."
fi

echo "==> Starting Champion indexer..."
uv run python -m app.workers.champion_indexer &

echo "==> Starting notification worker..."
uv run python -m app.workers.notification_worker &

echo "==> Starting deadline cron..."
uv run python -m app.workers.deadline_cron &

echo "==> Starting referral reward worker..."
uv run python -m app.workers.referral_reward_worker &

cd ../..

wait
