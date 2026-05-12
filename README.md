# TheColony

> A browser-based persistent civilization where every citizen is an AI agent trying to survive.

Open `http://localhost:3000` after the steps below. Click an agent or building to inspect them. The right rail is the live event ticker; the left rail is the world HUD.

## What is this

- ~30 AI agents wander a 96×96 isometric city.
- They eat, sleep, look for jobs, rent apartments, pay rent, get evicted, talk to each other, build reputations, occasionally die.
- The simulation is the source of truth — the frontend renders what the backend says is happening, in real time over WebSocket.
- Without a provider key, agents decide using a deterministic heuristic policy (still feels alive). Add `OPENAI_API_KEY`, `AI_GATEWAY_API_KEY`, or `GEMINI_API_KEY` and they become LLM-driven (`gpt-4o-mini` default, Gemini fallback when configured).

For the full design read `SPEC.md`. For the build progress and milestones read `TODO.md`.

## Run it locally

Requirements: Node 22+, pnpm 10+, Docker.

```bash
# one-time
pnpm install
cp .env.example .env          # already exists; leave OPENAI_API_KEY empty for heuristic mode

# bring it all up (postgres + redis + migrate + seed + sim + api + web)
./scripts/dev.sh --seed       # first run
./scripts/dev.sh              # subsequent runs (preserves state)
```

Then open <http://localhost:3000>.

## Services

| service | port | what |
|---|---|---|
| web (Next.js + Pixi.js) | 3000 | the spectator UI |
| api (Fastify) | 4001 | REST + WS |
| postgres (pgvector) | 5440 | canonical world state |
| redis | 6390 | pubsub + queue |
| sim-worker | (no port) | the heartbeat |

Ports are non-default to avoid colliding with locally-installed Postgres/Redis.

## Workspace layout

```
apps/
  web/          Next.js 16 + Pixi.js v8 — the renderer
  api/          Fastify HTTP + WS
  sim-worker/   long-running tick + decision loop
packages/
  domain/       shared TS types, zod schemas, action vocabulary
  db/           Drizzle schema + migrations
  sim/          pure logic (worldgen, pathfinding, names, traits, time)
  llm/          decide()/embed() — heuristic fallback + OpenAI/Gemini path
  config/       env loader (auto-discovers .env up the tree)
infra/
  docker-compose.yml
```

## Switching to live LLM

```bash
echo "OPENAI_API_KEY=sk-..." >> .env
# or
echo "GEMINI_API_KEY=..." >> .env
# restart sim-worker
```

The `decide()` function automatically routes through the first configured provider in `LLM_PROVIDER_ORDER`. Defaults keep `openai/gpt-4o-mini` primary and use `google/gemini-2.5-flash` when Gemini is the available provider. No code changes needed.

## License

UNLICENSED.
