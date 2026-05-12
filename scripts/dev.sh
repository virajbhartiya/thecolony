#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ bringing up postgres + redis"
docker compose -f infra/docker-compose.yml up -d
sleep 2

echo "→ running migrations"
pnpm --filter @thecolony/db exec tsx src/migrate.ts

if [ "${1:-}" = "--seed" ]; then
  echo "→ seeding 30 agents + 22 buildings + 10 companies"
  pnpm --filter @thecolony/sim-worker exec tsx src/seed.ts
fi

echo "→ launching sim-worker, api, web (Ctrl-C to stop all)"
pnpm dev
