# TheColony — Build Plan (LLM-executable)

> Companion to `SPEC.md`. Anything ambiguous here: defer to the spec; if the spec is also ambiguous, log a note in §99 "Open questions raised during build" and pick the most conservative interpretation.

## How to use this file

1. Work top-to-bottom. **Do not skip ahead between milestones.** Each milestone must end with a working, visible state.
2. For each task:
   - Read the task and any referenced spec section.
   - Implement.
   - Run the **Verify** step.
   - Tick the box: `[x]` and commit with a message that references the task ID (e.g., `M2-T07: agent decision pipeline online`).
3. If you can't verify, **do not tick the box**. Add a `<!-- BLOCKED: reason -->` comment under the task and move on only if the next task does not depend on it.
4. At the end of each milestone, run the **Milestone DoD** checklist before declaring it done.
5. Keep PRs (or commits) small: one task per commit when reasonable.

## Repo layout (target)

```
TheColony/
  apps/
    web/            # Next.js 16 — Vercel
    api/            # Fastify (HTTP + WS)         — EC2
    sim-worker/     # tick loop, decisions, jobs  — EC2
  packages/
    domain/         # shared TS types, zod schemas, action schemas
    db/             # drizzle schema + migrations
    llm/            # AI Gateway client + prompt templates
    sim/            # pure simulation logic (no IO) — testable
    ui/             # shadcn-derived components shared by /web
  infra/
    docker-compose.yml
    Caddyfile
  scripts/          # ops scripts (seed, replay, dump)
  SPEC.md
  TODO.md
```

Use pnpm workspaces + Turborepo. TypeScript strict. Node 24.

---

## M0 — Infra & scaffolding

Goal: empty rooms, lights on, plumbing connected. No simulation yet.

- [x] **M0-T01** Initialize pnpm + Turborepo monorepo with the layout above. Add `tsconfig.base.json`, strict mode. Add `.editorconfig`, `.prettierrc`, ESLint flat config.
  - Verify: `pnpm install` clean. `pnpm typecheck` returns 0.
- [x] **M0-T02** Scaffold `apps/web` with `create-next-app@latest` (App Router, TS, Tailwind). Wire shadcn/ui (`npx shadcn@latest init`).
  - Verify: `pnpm --filter web dev` renders default page locally.
- [x] **M0-T03** Scaffold `apps/api` (Fastify + TypeScript). Endpoint `GET /v1/health` returns `{ ok: true, t }`.
  - Verify: `pnpm --filter api dev` → `curl localhost:3001/v1/health` returns ok.
- [x] **M0-T04** Scaffold `apps/sim-worker` as a long-running Node process. For now: log "heartbeat" every second.
  - Verify: process stays up; logs heartbeat.
- [x] **M0-T05** Add `packages/db` with Drizzle. Wire to a local Postgres 16 (via Docker Compose). Add pgvector extension migration.
  - Verify: `pnpm --filter db migrate` runs on a fresh DB.
- [x] **M0-T06** Add `packages/domain` exporting TS types + zod schemas for the core entities in SPEC §4. Action schema (SPEC §5.5) lives here.
  - Verify: `import { AgentSchema } from '@thecolony/domain'` works from sim-worker.
- [x] **M0-T07** Add `infra/docker-compose.yml` for `postgres` (with pgvector image), `redis`, plus stubbed `api` and `sim-worker` services that just run their dev images.
  - Verify: `docker compose up -d postgres redis` healthy; `docker compose ps` shows them up.
- [x] **M0-T08** Add `infra/Caddyfile` for TLS on the EC2 box (placeholder domain). Configure to reverse-proxy `api.colony.tld` → api container and serve `/ws` upgrade.
  - Verify: `caddy validate Caddyfile` passes.
- [x] **M0-T09** Wire a `.env.example` and a `.env` loader (`packages/config`). Document required vars: `DATABASE_URL`, `REDIS_URL`, `AI_GATEWAY_KEY`, `WORLD_SPEED`.
  - Verify: `pnpm --filter sim-worker dev` fails loudly if `DATABASE_URL` missing.
- [ ] **M0-T10** GitHub Actions: lint + typecheck + unit tests on PR. Deploy `apps/web` to Vercel on push to main. Build + push Docker images for `api` and `sim-worker` to a registry.
  - Verify: dummy PR triggers all CI jobs green.
- [ ] **M0-T11** Web app shows a styled "Loading the city…" full-screen placeholder at `/`. Deployed to Vercel preview.
  - Verify: preview URL renders the placeholder.

**Milestone DoD:**
- Local: `docker compose up` brings up postgres + redis. Both apps start. `web` loads at localhost:3000.
- CI green on a placeholder PR.
- Vercel preview deployed.

---

## M1 — World renderer alive (no LLM, no economy)

Goal: visible, beautiful isometric city with agents walking around randomly. The "wow" pre-AI moment.

- [ ] **M1-T01** Add `apps/web/src/game/` directory. Install Pixi.js v8 (`pixi.js@^8`). Set up a single client component `<CityCanvas />` that boots a Pixi `Application` and renders a 96×96 isometric grass tile grid.
  - Verify: grid renders at 60 fps in `/`.
- [ ] **M1-T02** Drop in Kenney isometric city tileset (`public/tilesets/kenney-city/`). Build a tile atlas loader. Render terrain (grass/road/water) from a static layout JSON in `apps/web/src/game/seed/world-v0.json`.
  - Verify: visible plots, roads, and a river in the canvas.
- [ ] **M1-T03** Camera: pan with mouse drag and WASD; zoom with wheel and pinch. Clamp to map bounds. Persist transform in `localStorage`.
  - Verify: hand-test all controls; transform survives page reload.
- [ ] **M1-T04** Building sprite layer. Author 6 building types: house, apartment, shop, factory, bar, town_hall (using Kenney sprites). Read from world-v0.json. Each building has tile_x/y/w/h, sprite_key.
  - Verify: ~30 buildings render in correct isometric depth order.
- [ ] **M1-T05** Add HUD overlay (Tailwind/React) above the canvas: top bar with world clock (frontend-fake for now), bottom-right pause indicator (visual only), placeholder ticker rail on the right.
  - Verify: layout doesn't fight the canvas; overlay scrolls/resizes correctly.
- [ ] **M1-T06** Add Drizzle schema for `agent`, `building`, `world_event`, `agent_position` per SPEC §4. Migrations apply cleanly.
  - Verify: tables exist; `select count(*) from agent` runs.
- [ ] **M1-T07** Sim-worker seed script: insert 30 agents at random building positions with random names from a name bank in `packages/sim/data/names.json`. Insert the 30 buildings of M1-T04.
  - Verify: DB rows present after `pnpm --filter sim-worker seed`.
- [ ] **M1-T08** Add A* pathfinder in `packages/sim` over a passability grid derived from the static world. Unit-tested with at least 5 hand-crafted cases.
  - Verify: `pnpm --filter sim test` passes.
- [ ] **M1-T09** Sim-worker movement loop (no decisions yet): every 60 sim-seconds pick a random alive agent, pick a random building, A* path to it, update `agent.target_x/y` and write a `agent_moved` event. Continuous interpolation handled in worker for `pos_x/y` updates every 250ms.
  - Verify: `select pos_x, pos_y from agent` changes over time.
- [ ] **M1-T10** API: `GET /v1/world/snapshot` returns buildings + alive agents (id, name, pos, state). Cached for 1s.
  - Verify: response shape matches `WorldSnapshotSchema`.
- [ ] **M1-T11** API: WS endpoint `/v1/events/stream` subscribes a client to Redis `world.events`. Sim-worker publishes events. Throttle to 30 msg/s per client.
  - Verify: `wscat` shows live events when sim-worker is running.
- [ ] **M1-T12** Web client: replace `<CityCanvas />` stub with a real boot — fetch snapshot, render buildings + agents at received positions, connect WS, fold events into a Zustand world store. Pixi loop interpolates agents toward `target_x/y`.
  - Verify: open `/`, see 30 agents wandering between buildings. Day passes.
- [ ] **M1-T13** Day/night tint shader: tint the whole canvas based on a sim-time-of-day function. Add building "window lights" overlay for `night` segment.
  - Verify: dusk and dawn visible within 24 real min.
- [ ] **M1-T14** Click target: clicking an agent opens an `<AgentDrawer />` with mock content (id, name only). Clicking a building opens `<BuildingDrawer />` (id, kind).
  - Verify: hand-test 5 agents + 5 buildings.

**Milestone DoD:**
- A non-engineer can open `/` and say "that's a city, and tiny people are walking around."
- One short GIF captured of the live city for marketing folder.
- DB invariants: no agent has `pos_x` outside the map.

---

## M2 — LLM-driven decisions (no economy yet)

Goal: agents start making real choices. Memory begins. The city stops feeling like Brownian motion.

- [ ] **M2-T01** Add `packages/llm`: AI Gateway client wrapper. Functions: `decide(prompt, schema, opts)` (default `openai/gpt-4o-mini`, escalation `openai/gpt-4o`), `embed(text)`, `chat(turns)`. Includes retries, timeout, cost tracking hook. Provider/model lookup goes through a single config so swaps are config-only.
  - Verify: small e2e test hits Gateway sandbox (mocked in CI, real in dev) and returns valid JSON.
- [ ] **M2-T02** Implement the action schema (SPEC §5.5) as zod tagged union in `packages/domain`. Generate a JSON Schema from it for the Gateway tool call.
  - Verify: zod parses all 25 action variants. Round-trips through JSON schema.
- [ ] **M2-T03** Prompt template module (SPEC §5.4) in `packages/llm/prompts/agent.ts`. Pure function from `AgentContext` → string. Snapshot-tested.
  - Verify: 3 snapshot tests pass.
- [ ] **M2-T04** Memory module: `agent_memory` table CRUD + pgvector index. `recall(agent_id, queryText, k=8)` returns top-K + always-include last-24h-compressed.
  - Verify: insert 50 memories, query, top-K is deterministic for a fixed seed.
- [ ] **M2-T05** Decision pipeline in `apps/sim-worker/src/agent/decide.ts`. Steps: load → choose-model → prompt → call → validate → apply → publish → schedule (SPEC §5.2). Wrap apply step in a DB transaction.
  - Verify: integration test runs one decision tick against a real Postgres + a mocked LLM; agent state updates and an event row is written.
- [ ] **M2-T06** BullMQ queue `agent-decisions`. World heartbeat enqueues due agents. Concurrency limited (start at 5 workers).
  - Verify: 30 agents, all due → 30 jobs processed within 60s with mocked LLM.
- [ ] **M2-T07** Implement v1 actions: `idle`, `reflect`, `move`, `eat`, `sleep`, `speak (public)`. Eat consumes a sim-only food count on the agent (no economy yet — placeholder). Sleep advances energy and skips ticks.
  - Verify: hand-traced 1 hour of sim-time shows each action used at least once.
- [ ] **M2-T08** Speech-bubble effect: on `speak` event, web client shows a bubble above the agent for 4 seconds with the first 60 chars.
  - Verify: trigger 10 speaks via test script; bubbles render correctly.
- [ ] **M2-T09** Add daily memory consolidation job (BullMQ repeatable) that batches yesterday's events per agent into 10 summary memories via `gpt-4o-mini` in batch mode.
  - Verify: after 1 sim-day, each agent has ~10 fresh consolidated memory rows.
- [ ] **M2-T10** Add `world_event` partitioning by month + retention policy (keep 12 months hot, archive older).
  - Verify: `EXPLAIN` shows partition pruning on a time-bounded query.
- [ ] **M2-T11** Cost-budget guard in `packages/llm` reading `LLM_HOURLY_USD_CAP`. At 70% soft-warn, at 100% drop to thrift mode (skip 50% of routine ticks for low-salience agents).
  - Verify: forced cap of $0.01 triggers thrift within one tick cycle.

**Milestone DoD:**
- Watch the city for 10 minutes — agents move with apparent intent. Bubbles appear. Memories accumulate. No infinite loops.
- One captured GIF: an agent walks to a bar, "speaks," walks home, sleeps.
- Daily LLM spend on dev box < $5 with 30 agents.

---

## M3 — Economy: money, jobs, hunger that kills

Goal: scarcity introduced. Wages, rent, hunger. Agents that don't work die.

- [ ] **M3-T01** Add `item_type`, `inventory`, `money_account`, `ledger_entry`, `job`, `price_observation` schemas + migrations.
- [ ] **M3-T02** Seed the v1 item catalog (food, water, energy, cloth, tool, luxury). Seed 2 farms, 1 water-works, 1 power plant, 2 factories, 3 shops, 1 bar as companies (auto-owned by a "city" entity to start).
- [ ] **M3-T03** Implement `job` actions: `seek_job`, `quit_job`. Companies post listings as world events. Match wage to seeker's reservation wage (function of needs).
- [ ] **M3-T04** Production loop (BullMQ repeatable `daily-production`): each producing building outputs items to company inventory, scaled by workers × tool boost.
- [ ] **M3-T05** Payroll job: each sim-day, companies debit treasury / credit worker accounts. Partial payment triggers `labor_unrest` event.
- [ ] **M3-T06** Rent + housing: agents need `home_id`. Apartment buildings have units; `rent` action assigns one. Daily rent collection. Eviction after 3 missed days → home_id=null, "homeless" status tag.
- [ ] **M3-T07** Implement `buy` and `sell` actions against shop direct sales. Shops post a min_price; eat consumes inventory.
- [ ] **M3-T08** Hunger that kills: `needs.hunger` rises 33/day if no eat; pinned at 100 ≥ 3 sim-days → death event. Body remains visible for 1 day with a small "RIP" sprite.
- [ ] **M3-T09** Floating $ effects: on ledger entry involving a visible agent, render a `+$X` / `-$X` floater for 1.5s.
- [ ] **M3-T10** Update HUD: replace mock clock with real sim clock from snapshot. Add population, GDP (sum of treasuries + balances), and mood (avg life_satisfaction).
- [ ] **M3-T11** Replace `eat` placeholder in M2 with the inventory-backed `eat`. Update prompt context with "you have X food, $Y, hunger=Z."
- [ ] **M3-T12** Reservation-wage and price-anchoring heuristics: each agent has a small set of stable expectations updated weekly, surfaced in the prompt.
- [ ] **M3-T13** Migrant spawn: when alive pop < 30, spawn 1–3 migrants/day with starter wallet $200 and no home.

**Milestone DoD:**
- Run for 6 real-time hours with no human input. At least one agent dies of starvation. At least one is evicted. At least one quits a job. GDP graphable.
- Ledger invariant: `sum(debit) == sum(credit)`, checked by the nightly health job.

---

## M4 — Social, reputation, gossip

Goal: society. Rumors propagate. Agents have opinions of each other.

- [ ] **M4-T01** Add `conversation`, `conv_participant`, `message`, `broadcast`, `agent_relationship` tables.
- [ ] **M4-T02** Conversation engine: when two agents both attempt `speak nearby`, open a conversation; up to 6 turns; one cheap LLM call per turn per participant with a shared running context.
- [ ] **M4-T03** Relationship updates: a small classifier (heuristic + occasional LLM) converts each conversation outcome into `(affinity Δ, trust Δ, tags Δ)` for both directed edges.
- [ ] **M4-T04** Gossip propagation: on each conversation turn, probability p=f(sociability) that one of the speaker's high-salience memories is "told" to the listener (mutated by personality bias).
- [ ] **M4-T05** Public `broadcast` action: speaker pays cost, audience = agents in zone radius receive an event with importance scaled by speaker's salience.
- [ ] **M4-T06** Ticker (HUD right rail): show last 15 high-importance events with animation. Hover → mini agent peek. Click → drawer.
- [ ] **M4-T07** Agent drawer v2: needs bars, top relationships with signed numbers, recent events, last 5 consolidated memories.
- [ ] **M4-T08** Output safety filter (SPEC §13.3): block PII patterns + slurs + AI-language-model echoes. Failing outputs become `idle` and log the prompt.

**Milestone DoD:**
- Two agents form a clearly-readable relationship over the day (positive or negative). One rumor visibly propagates: an opinion appears in an agent who never met the subject.
- Output filter has zero leaks across a 1-hour soak test.

---

## M5 — Spectator UX polish

Goal: shareable. Every screen pulls its weight.

- [ ] **M5-T01** `/agent/[id]` full page (not just drawer): big portrait, full memory timeline, full event log, relationship graph (force-directed), holdings, ideology.
- [ ] **M5-T02** `/building/[id]` full page: employees, transactions chart, recent inventory.
- [ ] **M5-T03** `/feed` page: paginated firehose with filters (kind, actor, importance).
- [ ] **M5-T04** `/leaderboards` page: richest, most loved (sum affinity in), most hated (sum negative affinity in), most notorious (warrants + crime severity).
- [ ] **M5-T05** Tour mode button on `/`: every 8s, auto-pan to the next world event with `importance >= 7`. Hard exit on user interaction.
- [ ] **M5-T06** "Follow agent" mode in agent drawer: camera locks and tracks until released.
- [ ] **M5-T07** Generated portraits: deterministic SVG composition seeded by `portrait_seed` (skin, hair, top, accessory). Cached as `<img>` data-URLs.

**Milestone DoD:**
- Public soft launch test: 5 friends spend 10+ min on the site without prompting; each clicks ≥ 3 agents.

---

## M6 — Companies & markets

- [x] **M6-T01** Add `company`, `company_member`, `share_holding`, `market_order` schemas.
- [x] **M6-T02** `found_company` action: requires min capital. Creates company row, charter, founder as exec.
- [x] **M6-T03** `hire` / `fire` actions; companies emit job postings; `seek_job` matches against postings.
- [x] **M6-T04** `issue_shares` action; once issued past threshold, company appears on `/market`.
- [x] **M6-T05** Market clearer (BullMQ repeatable every 15 sim-min): price-time priority match, write trades to ledger, update share holdings, emit `trade` events.
- [x] **M6-T06** `/market` page: list public companies with price sparklines, order book preview, top movers.

**Milestone DoD:**
- A founded company hires ≥ 1 worker, issues shares, and shows a price chart within 24 sim-hours.

---

## M7 — Crime & justice

- [x] **M7-T01** Add `incident`, `legal_status` schemas. Build `steal`, `assault`, `fraud`, `breach` actions.
- [x] **M7-T02** Witness model: nearby agents at the time of crime get a `witnessed_X` event. Reporting probability = f(empathy, relationship to victim).
- [x] **M7-T03** Court job (BullMQ repeatable `court-session` daily): processes accusations vs. evidence; guilty → jail N sim-days + civil damages.
- [x] **M7-T04** Jail mechanic: jailed agents `status='jailed'`, their decision pipeline reduces to `idle | reflect` until release.
- [ ] **M7-T05** Bounty: agents above 3 warrants are bountied; other agents may `accuse` and receive bounty if conviction follows.
- [x] **M7-T06** `/crime` page: heatmap of incidents, top criminals list, recent incident feed.

**Milestone DoD:**
- One full crime arc captured in logs: crime → witness → accusation → court → jail → release.

---

## M8 — Groups & ideology

- [ ] **M8-T01** Add `ideology_group`, `group_membership` schemas.
- [ ] **M8-T02** `found_group` action: cult|party|union|club + doctrine. Doctrine generated by LLM (escalated `gpt-4o` call).
- [ ] **M8-T03** `join_group` / `leave_group` actions; doctrine added to member prompt template.
- [ ] **M8-T04** Weekly belief-update job: per agent, summarize the week's consolidated memories into a one-line belief; updates `traits.ideology_lean`.
- [ ] **M8-T05** `/groups` page: list of all groups with doctrine excerpt, member count, founder, recent activity.

**Milestone DoD:**
- Within 1 sim-week of M8 going live, at least one group is founded by an agent without scripted prompting.

---

## M9 — Permadeath, descent, legacy

- [ ] **M9-T01** All death causes from SPEC §7.6 implemented and surfaced as distinct death_event causes.
- [ ] **M9-T02** Conception model: two cohabiting agents with affinity > 60 + age window → daily small probability of conception → child active at age 18 sim-years with parent-blended traits.
- [ ] **M9-T03** Obituary generator: on death, one `gpt-4o` call writes a 4–6 sentence eulogy; stored on `death_event.eulogy`.
- [ ] **M9-T04** `/history` page: chronological timeline of high-importance events + obituaries grid for the dead.

**Milestone DoD:**
- The first 5 obituaries are good enough to share as screenshots.

---

## M10 — Hardening & launch

- [ ] **M10-T01** Cost guard live with paging (Slack/email webhook). Soft 70% / hard 100%.
- [ ] **M10-T02** Determinism replay: given an `agent_decision_log` row, replay produces the same action under the same seed.
- [ ] **M10-T03** Daily-report job: nightly markdown summary posted to `/news` and a static archive.
- [ ] **M10-T04** Public read API rate limiting (per-IP token bucket) at the api layer.
- [ ] **M10-T05** Frontend perf pass: tree-shake, dynamic-import Pixi, lazy-load drawers, lighthouse perf ≥ 80 desktop.
- [ ] **M10-T06** Production runbook: how to pause world, how to bump speed, how to roll a model, how to restore from backup, how to handle PII/abuse reports.
- [ ] **M10-T07** Postgres backup: pg_dump to S3 every 6 real hours, 14-day retention.
- [ ] **M10-T08** Launch checklist sweep: DNS, TLS, terms-of-use, FAQ, "what is this" video.
- [ ] **M10-T09** Public launch.

**Milestone DoD:**
- Site runs 7 real days unattended without dropping below 1× speed.
- One viral-worthy story captured from those 7 days.

---

## 99. Open questions raised during build

> Add notes here when the spec is ambiguous or assumptions break. Format: `[task-id] question — what you did instead`.

- _(empty)_
- [M6-T05] market cadence — implemented as a 15-tick worker cadence for the demo-speed world, preserving the same order-clearing behavior while the sim is running at accelerated local demo pace.
- [M7-T03] court cadence — implemented as a 30-tick worker cadence for the demo-speed world instead of a daily BullMQ repeatable job; the same court resolution path runs while local sim time is intentionally accelerated.

---

## Decision log (delta from spec — only record changes)

> If you deviate from `SPEC.md`, log the why here.

- [M7-T03] Court runs on the sim-worker heartbeat every 30 ticks in local demo mode instead of a daily BullMQ repeatable job, so crime arcs are visible during product testing.
