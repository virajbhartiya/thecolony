#!/usr/bin/env bash
# Bring up the TheColony stack on the host. Run from the repo root.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "→ no .env, copying from .env.example. EDIT IT before running again." >&2
  cp .env.example .env
  echo "→ paused. Edit .env (set OPENAI_API_KEY, ensure ports are right), then re-run." >&2
  exit 1
fi

echo "→ docker compose up postgres + redis"
docker compose -f infra/docker-compose.yml up -d

echo "→ pnpm install (workspace)"
pnpm install --prod=false

echo "→ db migrate"
pnpm --filter @thecolony/db exec tsx src/migrate.ts

if [ "${1:-}" = "--seed" ]; then
  echo "→ seeding world (DESTRUCTIVE — wipes data)"
  pnpm --filter @thecolony/sim-worker exec tsx src/seed.ts
fi

echo
echo "✔ DB + Redis up. Migrations applied."
echo
echo "Next:"
echo "  sudo cp infra/colony-api.service /etc/systemd/system/colony-api.service"
echo "  sudo cp infra/colony-sim.service /etc/systemd/system/colony-sim.service"
echo "  sudo sed -i \"s|/REPO|$(pwd)|g\" /etc/systemd/system/colony-api.service /etc/systemd/system/colony-sim.service"
echo "  sudo sed -i \"s|RUNUSER|$(whoami)|g\" /etc/systemd/system/colony-api.service /etc/systemd/system/colony-sim.service"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable --now colony-api colony-sim"
echo
echo "  sudo cp infra/Caddyfile /etc/caddy/Caddyfile"
echo "  sudo systemctl restart caddy"
