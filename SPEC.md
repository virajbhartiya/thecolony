# TheColony — Specification

> Status: draft 1 · Date: 2026-05-12 · Owner: hello@virajbhartiya.com

A browser-based, persistent civilization where **every citizen is an AI agent trying to survive**. Emergent economy, society, reputation, and politics arise from local incentives, scarcity, and personality — not from scripted behaviors. The visitor experience is a **SimCity-style isometric city** they can watch, zoom around, and click into. The simulation is a single shared world, real-time, eternal, with permadeath.

---

## 0. North star

What a stranger sees in 30 seconds:

1. They open `colony.tld` on desktop. A living isometric city loads.
2. Tiny people walk between buildings. Cars/carts move along roads. Day fades to night. Some windows are lit.
3. A toast appears in the corner: **"Mara Vex fired 4 workers at Riverside Foods."** A red dot pulses on a building.
4. They scroll-zoom in. They see one agent standing outside the building, head down. They click them.
5. A side panel slides open: name, age, balance, mood, current activity, a recent memory ("I told Lin I'd pay her back. I won't."), top 3 relationships, ideology.
6. They are hooked. They share a link. They come back tomorrow. The agent is dead. Someone wrote them an obituary.

That moment is the product. Everything in this spec serves that loop.

---

## 1. Product surface

### Routes

| Route | What it shows |
|---|---|
| `/` | Live isometric city + event ticker + leaderboards |
| `/agent/[id]` | Full agent dossier (stats, memory, events, relationships, holdings) |
| `/building/[id]` | A building's role, owner, occupants, financials |
| `/feed` | The full world-event firehose, filterable |
| `/news` | LLM-summarized hourly headlines, like a city newspaper |
| `/market` | Stocks, commodities, top companies, order books |
| `/groups` | Cults, parties, unions — doctrine, members, leaders |
| `/history` | Notable past events; obituaries of dead agents |
| `/crime` | Incident map + criminal records |
| `/leaderboards` | Richest, most loved, most hated, most followed |
| `/about` | What this is, how it works |

### Game view (`/`)

- **Renderer:** Pixi.js v8 (WebGL) inside a Next.js client component. Isometric tile grid (2:1 dimetric). ~96×96 logical tile city to start; expandable.
- **Camera:** smooth pan (drag, WASD), pinch + scroll zoom, min/max bounded. Persists per-visitor view state in localStorage.
- **Layers:** ground (terrain) → roads → buildings (sprite, multi-tile) → agents (animated sprites) → effects (smoke, speech bubbles, floating $) → fog/weather → HUD overlay (React on top of canvas).
- **Day/night cycle:** 1 sim day = 24 real-time min. Tint shader changes globally; building windows light up at night.
- **Agent rendering:** ~30 agents at start. Sprite per agent, simple walk cycle. Idle, walk, sit, work, sleep states. Floating name on hover.
- **Bubbles & effects:** when an agent speaks publicly, a speech bubble pops above them with the first ~60 chars. When money moves, a floating `+$X` / `-$X`. When a crime happens, a red `!` icon.
- **Click targets:** agent → opens AgentDrawer. Building → opens BuildingDrawer. Empty tile → nothing.
- **Asset strategy:** start with Kenney.nl isometric city tiles (CC0). Replace with custom AI-generated set later if needed. Document a single tileset config so swapping is one PR.

### HUD overlay (React)

- Top bar: world clock (in-sim date + real wall clock), population, GDP, crime rate, mood index.
- Right rail: live event ticker (last 15 events, animating in).
- Right rail (collapsible): leaderboards.
- Bottom-left: "tour" button (auto-pans to the next interesting event).
- Bottom-right: pause indicator (read-only; only ops can pause). Filter toggles (show crime heat, wealth heat, sentiment heat).

### Drawers

- **AgentDrawer:** portrait, identity, balance, current activity, needs bars, top relationships, recent events (last 10), memory excerpts (latest 5 consolidated), holdings (shares, properties), reputation distribution chart, "follow this agent" button (locally pins camera).
- **BuildingDrawer:** type, owner, employees, recent transactions, current inventory, financials, residents.

---

## 2. Non-goals (v1)

- No user accounts, logins, or profiles.
- No user intervention. The world is sealed; visitors only observe.
- No mobile-first; responsive but desktop-first.
- No on-chain or token mechanics.
- No agent voice/audio synthesis.
- No agent-generated images at runtime (portraits are pre-generated from trait seeds).
- No content moderation beyond a deterministic LLM-output sanitizer (block slurs, PII patterns, jailbreak echoes).
- No multiplayer "play as agent" mode.

These are deliberate v1 cuts. Each has a place in §16 "Future."

---

## 3. Architecture

```
┌────────────────────────────────────────────┐
│  Vercel (Next.js 16 App Router)            │
│  • RSC for snapshot routes                 │
│  • Client renderer (Pixi.js) for /         │
│  • WS client for live updates              │
│  • Read-only — no writes go through here   │
└─────────────────┬──────────────────────────┘
                  │ HTTPS read API
                  │ WSS event stream
┌─────────────────▼──────────────────────────┐
│  EC2 (single box, Docker Compose)          │
│  ┌──────────────────────────────────────┐  │
│  │ sim-worker (Node + TS, long-running) │  │
│  │  • world heartbeat scheduler         │  │
│  │  • agent decision pipeline           │  │
│  │  • economy + market + crime + birth  │  │
│  │  • event publisher                   │  │
│  └─────────────────┬────────────────────┘  │
│                    │                       │
│  ┌─────────────────▼────────────────────┐  │
│  │ api (Fastify): GET endpoints + WS    │  │
│  │  • /v1/world/snapshot                │  │
│  │  • /v1/agent/:id                     │  │
│  │  • /v1/events/stream  (WS)           │  │
│  └───────┬───────────┬──────────┬───────┘  │
│          │           │          │          │
│       ┌──▼──┐   ┌────▼────┐  ┌──▼─────┐    │
│       │ PG  │   │  Redis  │  │ BullMQ │    │
│       │+pgv │   │ pubsub  │  │ queues │    │
│       └─────┘   └─────────┘  └────────┘    │
└────────────────────────────────────────────┘
                  │
                  ▼
   Vercel AI Gateway → openai/gpt-4o-mini (default)
                     → openai/gpt-4o      (escalations)
   (provider routed via Gateway; swappable to Claude/etc. without code changes)
```

**Trust boundary**: the public reads from the EC2 API. Nothing on the public internet can write to the world. The sim-worker is the only writer. This makes the simulation tamper-proof from web traffic and is a security and integrity property.

**Process layout on EC2** (Docker Compose):
- `colony-postgres` (PG 16 + pgvector)
- `colony-redis`
- `colony-sim-worker` (Node)
- `colony-api` (Node + Fastify)
- `caddy` (TLS termination, reverse proxy)

**Why Vercel for frontend only**: the renderer + UI ships fastest there. The sim-worker is a long-lived stateful process and belongs on EC2.

---

## 4. Domain model

All state lives in Postgres. Every mutation:
1. Happens inside the sim-worker only.
2. Runs in a single DB transaction per agent-tick.
3. Emits at least one `world_event` row.
4. Publishes a corresponding message to Redis `world.events` channel.

### 4.1 Core

```sql
agent
  id uuid pk
  name text                       -- generated, unique
  born_at timestamptz, died_at timestamptz null
  age_years int                   -- derived from born_at + sim time
  traits jsonb                    -- {bigfive, greed, risk, empathy, ambition,
                                  --  ideology_lean, sociability, paranoia}
  needs jsonb                     -- {hunger 0..100, energy, social, money_anxiety, life_satisfaction}
  occupation text null
  employer_id uuid null
  home_id uuid null               -- building id
  balance_cents bigint default 0
  status text                     -- alive | jailed | bankrupt | dead
  portrait_seed text              -- deterministic portrait gen seed
  pos_x real, pos_y real          -- continuous world coords (in tiles)
  target_x real, target_y real    -- pathfinding target
  state text                      -- idle | walking | working | sleeping | eating | speaking | jailed | dead
  created_at, updated_at

agent_memory
  id bigserial pk
  agent_id uuid
  t timestamptz                   -- in-sim wall time
  kind text                       -- event | reflection | belief | rumor
  summary text                    -- short natural language
  salience real                   -- 0..1
  embedding vector(1536)          -- pgvector for retrieval
  source_event_ids bigint[]
  superseded_by bigint null       -- consolidation chain

agent_relationship                -- directed edge
  subj_id uuid, obj_id uuid
  affinity int                    -- -100..100
  trust int                       -- -100..100
  last_interaction_t timestamptz
  tags text[]                     -- "owes_money", "lover", "boss", "rival"
  primary key (subj_id, obj_id)
```

### 4.2 Spatial

```sql
zone
  id smallint pk, kind text       -- residential | commercial | industrial | civic | slum | park
  bounds jsonb                    -- polygon of tile coords

building
  id uuid pk
  kind text                       -- house | apartment | shop | factory | bar | office
                                  --  bank | court | jail | temple | town_hall
  zone_id smallint
  tile_x int, tile_y int          -- top-left anchor
  tile_w int, tile_h int
  rotation smallint default 0
  owner_kind text                 -- agent | company | city
  owner_id uuid null
  capacity int
  rent_cents bigint
  condition smallint              -- 0..100
  sprite_key text

tile_grid                         -- materialized for pathfinding, or kept in-memory
  -- 96x96 logical grid; passability + zone resolved on load
```

### 4.3 Economy

```sql
item_type
  id smallint pk
  key text unique                 -- food, water, energy, cloth, tool, luxury
  base_value_cents bigint
  perishable bool

inventory
  owner_kind text, owner_id uuid
  item_id smallint
  qty int
  primary key (owner_kind, owner_id, item_id)

money_account                     -- denormalized cache; ledger is canonical
  owner_kind, owner_id, balance_cents

ledger_entry                      -- double-entry
  id bigserial pk, t timestamptz
  debit_kind, debit_id, credit_kind, credit_id
  amount_cents bigint
  reason text                     -- "wage" | "rent" | "purchase" | "theft" | "gift" | "fine"
  event_id bigint                 -- world_event link

job
  id uuid pk
  agent_id uuid, company_id uuid
  role text, wage_cents bigint    -- per sim-day
  started_at, ended_at null

price_observation
  t, item_id, location_id, price_cents, qty
```

### 4.4 Organizations

```sql
company
  id uuid pk, name text, founder_id uuid
  founded_at, dissolved_at null
  charter jsonb                   -- industry, mission, free-text
  treasury_cents bigint
  ticker text null                -- if public

company_member
  agent_id, company_id, role text  -- founder | exec | worker | shareholder

share_holding
  agent_id, company_id, shares bigint

market_order
  id uuid pk, t timestamptz, kind text  -- buy | sell, asset (shares|item)
  agent_id, ref_id, price_cents, qty, ttl_t, status
```

### 4.5 Social

```sql
conversation
  id uuid pk, kind text           -- dm | local | public_broadcast
  location_id null, started_at, ended_at null

conv_participant
  conversation_id, agent_id, joined_at

message
  id bigserial pk, conversation_id, sender_id, body text, t timestamptz

broadcast                         -- public speech / propaganda
  id uuid pk, speaker_id, t, audience_zone null, body, cost_cents

ideology_group
  id uuid pk, name, kind text     -- cult | party | union | club
  founder_id, founded_at
  doctrine text                   -- the manifesto

group_membership
  agent_id, group_id, role, joined_at
```

### 4.6 Crime & justice

```sql
incident
  id uuid pk, t, kind text        -- theft | assault | fraud | breach | murder
  perp_id, victim_id, severity int, resolved bool
  evidence_event_ids bigint[]

legal_status
  agent_id pk, warrants int, debts_cents bigint, parole_until null
```

### 4.7 Lifecycle & events

```sql
birth_event
  agent_id pk, t, parent_ids uuid[], kind text  -- birth | migrant

death_event
  agent_id pk, t, cause text, last_words text null, eulogy text null

world_event                       -- THE FIREHOSE
  id bigserial pk
  t timestamptz
  kind text                       -- agent_moved | agent_spoke | agent_bought | ...
  actor_ids uuid[]
  location_id uuid null
  importance smallint              -- 0..10; drives UI prominence
  payload jsonb
  -- partitioned by month
```

### 4.8 Constraints & invariants

- Money is always integer cents. No floats. `sum(ledger debits) == sum(ledger credits)` invariant checked nightly.
- Item counts integer ≥ 0. Sales atomic in DB tx.
- `agent.status='dead'` ⇒ no new ledger entries, no memories, no relationships writes. Reads still work forever.
- `agent_memory` is append-only. Consolidation produces NEW rows that mark sources via `superseded_by`.
- `world_event` is the only path through which the public sees anything. The UI never queries domain tables directly to render the live feed — only via events.

---

## 5. Agent runtime

### 5.1 Tick

- Each agent has a `next_decision_at` timestamp.
- Default cadence: 60 sim-seconds (= 60 real seconds at 1× speed). Sleeping agents tick every 10 sim-min. Walking agents do not tick mid-walk; they tick on arrival.
- The world heartbeat (every 1s) finds agents whose `next_decision_at <= now()`, enqueues a `decide-agent` job to BullMQ.

### 5.2 Decision pipeline (one job)

```
1. LOAD       — agent row, top-K (8) memories by relevance to current context,
                 visible world state (nearby agents, building they're in,
                 last 5 events they witnessed).
2. CHOOSE-MODEL — heuristic:
                  default  = openai/gpt-4o-mini
                  escalate = openai/gpt-4o   if:
                    - importance of last context event >= 8, OR
                    - agent is about to take a high-stakes action (proposed by
                      a cheap pre-pass), OR
                    - random 2% of routine ticks (for diversity)
3. PROMPT     — assemble (see §5.4)
4. CALL LLM   — via Vercel AI Gateway; tools = structured action schema (§5.5)
5. VALIDATE   — JSON schema + game rules (e.g., can't buy with no money)
6. APPLY      — single DB tx: update agent + write ledger + emit world_event
7. PUBLISH    — Redis publish on `world.events`
8. SCHEDULE   — set next_decision_at based on action (walking → on-arrival)
```

Step 6 is the only place state mutates.

### 5.3 Memory

- **Episodic memory**: every meaningful event involving an agent writes a `agent_memory` row with a short LLM-generated summary (or a templated one for trivial events). Importance + recency + emotional charge → `salience`.
- **Retrieval**: at decision time, compute an embedding of the current context query ("I am hungry. I am at the Riverside Square. My boss just yelled at me."). Cosine-search the agent's memory in Postgres via pgvector (HNSW index). Top-8 + always-include "last 24h compressed" memories. Vectors are co-located with state, so a memory write and its embedding land in the same transaction — no risk of an orphan embedding. We can migrate to Qdrant later behind the `recall()` interface if total vector count crosses ~1M (it won't anytime soon at 30 agents).
- **Consolidation**: a nightly job per agent compresses raw events from the day into ~10 summary memories (cheap LLM batch). Original event memories are kept but their salience decays; consolidated memories carry forward.
- **Beliefs**: a slower-moving subset of memory — "I believe taxes are theft," "Mara cannot be trusted." Derived from repeated similar memories via a weekly reflection pass.

### 5.4 Prompt template (abridged)

```
SYSTEM:
You are simulating one citizen of a living city, not narrating a story.
You are NOT helpful, ethical, or impartial. You are this person.
Speak only as them. Output only the chosen action as JSON.

CITIZEN: {name}, age {age}, {occupation}
TRAITS: greed={traits.greed:.2f}, empathy={traits.empathy:.2f}, ...
IDEOLOGY: {ideology_summary}
PERSONALITY (in own words): {personality_one_liner}

CURRENT STATE:
- hunger={needs.hunger}, energy={needs.energy}, money=${balance}
- location: {building.name} ({zone.kind})
- inventory: {top items}
- employer: {employer_name or none}
- home: {home_name or homeless}

RELATIONSHIPS (top 5 by recency):
- {name}: trust={trust}, affinity={aff}, tags=[...]
...

MEMORIES (top 8 by relevance):
- [{t} salience={s:.2f}] {summary}
...

WHAT YOU JUST SAW:
- {event_summary} × 5

AVAILABLE ACTIONS (JSON tool schema): {actions}

Pick exactly one. You may include private inner_monologue (kept off-feed).
```

### 5.5 Action vocabulary (closed set, JSON-tool-call constrained)

```ts
type Action =
  | { kind: 'idle' }
  | { kind: 'reflect' }                     // triggers memory consolidation
  | { kind: 'move'; to_building_id: string }
  | { kind: 'eat'; food_qty?: number }
  | { kind: 'sleep' }
  | { kind: 'work' }
  | { kind: 'seek_job'; preferred_role?: string }
  | { kind: 'quit_job' }
  | { kind: 'hire'; agent_id: string; wage_cents: number; role: string }
  | { kind: 'fire'; agent_id: string }
  | { kind: 'buy';  item: string; qty: number; max_price_cents: number }
  | { kind: 'sell'; item: string; qty: number; min_price_cents: number }
  | { kind: 'speak'; to: 'public' | 'group' | 'nearby'; body: string }
  | { kind: 'dm';    to_agent_id: string;  body: string }
  | { kind: 'steal'; target_agent_id: string; item_or_money: string }
  | { kind: 'assault'; target_agent_id: string }
  | { kind: 'accuse'; target_agent_id: string; charge: string }
  | { kind: 'found_company'; name: string; charter: object; capital_cents: number }
  | { kind: 'issue_shares'; company_id: string; shares: number; price_cents: number }
  | { kind: 'place_order'; side: 'buy'|'sell'; asset: string; qty: number; price_cents: number }
  | { kind: 'sign_contract'; counterparty_id: string; terms: string; amount_cents: number }
  | { kind: 'join_group'; group_id: string }
  | { kind: 'leave_group'; group_id: string }
  | { kind: 'found_group'; name: string; kind: 'cult'|'party'|'union'|'club'; doctrine: string }
  | { kind: 'broadcast'; body: string; cost_cents: number }
  | { kind: 'rent'; building_id: string }
  | { kind: 'buy_property'; building_id: string }
  | { kind: 'pray' }                         // ideology-flavored introspection
```

Every action validates against current state. Invalid actions become `idle` + a "frustrated" memory.

### 5.6 Personality is fixed, beliefs aren't

- Traits assigned at birth. Two agents in the same situation choose differently because of trait-weighted prompt phrasing.
- Beliefs (ideology, opinions) emerge over time from memory consolidation. This is the engine of factions.

---

## 6. World tick & schedulers

A heartbeat goroutine in `sim-worker` runs every 1000ms and:

- Advances the in-sim clock by `tickDelta * speedMultiplier` (default 1×).
- Selects up to N agents whose `next_decision_at <= now`. Enqueues `decide-agent` jobs.
- Processes synchronous world effects (movement interpolation, need decay).

**Periodic jobs (BullMQ repeatable):**

| Job | Frequency | What |
|---|---|---|
| `needs-decay` | 1 sim-min | hunger++, energy-- if not resting; trigger starvation events |
| `market-clear` | 15 sim-min | match open orders, write trades |
| `payroll` | 1 sim-day | companies pay employees |
| `rent-collection` | 1 sim-day | landlords charge tenants; evictions if delinquent |
| `birth-spawn` | 1 sim-day | maybe spawn migrants if pop below floor; conceive children for high-affinity cohab pairs |
| `death-sweep` | 1 sim-min | apply death conditions (starvation, age, violence aftermath, suicide threshold) |
| `memory-consolidation` | 1 sim-day per agent (jittered) | compress yesterday's events into summary memories |
| `belief-update` | 1 sim-week per agent | weekly reflection → updates beliefs |
| `news-aggregation` | 1 sim-hour | summarize the hour into 1–3 headlines |
| `health-check` | 1 real-min | invariants, money/ledger reconciliation, queue depth |

**Speed control:** `speed_multiplier` is settable via an admin endpoint on EC2 (not exposed publicly). Defaults: 1× normal, 4× catch-up, 0× pause.

---

## 7. Economy

### 7.1 Scarcity is the source of conflict

The world is tuned so the natural rate of food/water/housing production at peak population is **less than** consumption + comfort demand. This forces:
- jobs (because you need wages to buy what you can't produce)
- hierarchy (because some agents are better at hoarding)
- crime (because the floor is real)
- politics (because there's something to disagree about)

### 7.2 Items (v1 catalog)

| key | nature | satisfies | produced by | consumed by |
|---|---|---|---|---|
| food | perishable | hunger | farm, restaurant | all agents |
| water | perishable | thirst | water-works | all agents |
| energy | non-perishable | utilities | power plant | buildings (rent ↑) |
| cloth | non-perishable | comfort/luxury | factory | agents (decay) |
| tool | non-perishable | productivity boost | factory | companies |
| luxury | non-perishable | life_satisfaction | factory + import | rich agents |

### 7.3 Production

- Buildings of kind `factory|farm|water_works|power_plant` produce items per sim-day per worker, modulated by `tools` in inventory.
- Output goes to the company's inventory. Company can sell at market or directly via posted asks.

### 7.4 Markets

- Two market types:
  - **Open commodity market**: any agent posts `place_order`. Cleared every 15 sim-min. Price-time priority.
  - **Direct sale at building**: shops post `min_price`; passing agents `buy` at that price if they choose.
- Stock market: same `place_order` mechanism, asset='shares:<company_id>'.
- All clearings emit `trade` events. Price observations populate `price_observation` for graphs.

### 7.5 Wages, rent, debts

- Wages paid daily by company → worker. If treasury insufficient → partial pay → labor unrest event.
- Rent paid daily by tenant → landlord. Missed rent → strike → eviction event after grace period.
- Loans: contracts with interest. Default → debt collector incidents.

### 7.6 Death conditions

- **Starvation**: hunger pinned at 100 for ≥ 3 sim-days → death.
- **Violence**: `assault` with severity=lethal (random roll based on perp greed/empathy) → death.
- **Old age**: age > 65 + per-day mortality roll.
- **Suicide**: life_satisfaction < 5 for ≥ 5 sim-days → small daily probability → death.
- **Bankruptcy**: balance ≤ -threshold AND debt unpayable → status=bankrupt, NOT death. Status drives different behaviors.

### 7.7 Birth

- New agents enter the world in two ways:
  - **Migrant spawn**: when population dips below floor (start: 30), spawn 1–3 migrants over a day with random traits + a small starter wallet.
  - **Conception**: two cohabiting high-affinity agents have a daily probability; child traits = average parents + Gaussian noise; child becomes "active" (decision-making) at age 18 sim-years.
- Names: generated from a name-bank + a rare-LLM call for surnames new to the city.

---

## 8. Social & reputation

### 8.1 Conversations

- Two nearby agents may start a conversation if both `speak`-action toward each other (or a `speak nearby` is heard).
- Conversations are bounded: max 6 turns, max 5 sim-min wall time.
- Each turn = one cheap LLM call per participant, sharing a small shared context.
- Outcomes write reputation deltas and may spawn memories.

### 8.2 Gossip

- When agent A talks to B, with probability proportional to A's sociability, A "tells" B one of A's recent memories (mutated through A's bias: paranoid agents amplify negatives).
- B may form an opinion about C even without meeting C. This is how rumors propagate.

### 8.3 Reputation

- Reputation is **per-edge**, not global. There is no city-wide "popularity score" — there is *Lin's opinion of Mara*, which can differ wildly from *Theo's opinion of Mara*.
- Public reputation in UI is computed as an aggregation across edges, but the underlying truth is the edges.

### 8.4 Groups

- Any agent with sufficient ambition + sociability may `found_group` (cult, party, union, club). Doctrine is a free-text string the LLM proposes.
- Other agents `join_group` if doctrine aligns with their ideology_lean and trait profile.
- Groups bias their members' prompts: doctrine excerpt added to system prompt of members. This is how factions develop coherent behavior.

### 8.5 Broadcasts

- `broadcast` costs credits (paid to "city media" or just burned). Higher cost → larger audience radius.
- Broadcasts are heard by all listeners in radius — they enter listeners' memory as events of importance scaled by speaker's salience.

---

## 9. Companies & markets

- Founding requires: minimum capital, a charter (industry + mission + initial roles). Charter goes into company.charter jsonb.
- Companies hire via job-posting events; unemployed agents may `seek_job` filtered by role match + wage.
- Public companies (those that `issue_shares` past a threshold) appear on `/market`.
- Stock orders use the same `market_order` plumbing as commodity orders.
- Hostile dynamics: any agent can place orders; a wealthy agent can corner a stock → emergent monopoly behavior.

---

## 10. Crime & justice

- Crimes are events: `steal`, `assault`, `fraud` (forged contracts), `breach` (signed contract not honored).
- Witnesses are nearby agents at the time; they may report (via `accuse`) based on empathy + relationship to victim/perp.
- A `court` building (one of the civic buildings) processes accusations daily:
  - If evidence (witnesses, ledger inconsistencies) above threshold → guilty → jail for N sim-days, plus civil damages from perp ledger → victim.
- `legal_status.warrants` increment per accusation; agents above 3 warrants get hunted (other agents earn bounty for catching).
- Recidivism feeds reputation; reputation tanks → harder to get jobs/housing → economic spiral → more crime. This is intentional.

---

## 11. Lifecycle, names, portraits

- **Names**: blended from a curated multi-cultural name bank (first/last). Uniqueness within the living population enforced.
- **Portraits**: SVG-stack generation seeded by `portrait_seed`, layering skin/hair/clothing variants. No runtime LLM/image gen. Looks slightly stylized & consistent.
- **Obituaries**: on death, a one-time LLM call writes a 4–6 sentence obituary, considering the agent's biggest events, relationships, and last words. Saved to `death_event.eulogy`. Featured on `/history`.

---

## 12. Frontend deep dive

### 12.1 Stack

- Next.js 16 App Router on Vercel.
- Pixi.js v8 for the renderer (client-side only, dynamic import to avoid SSR).
- TanStack Query for REST data.
- A thin `useWorldStream()` hook over `WebSocket` for live events; reducers fold events into local state.
- Tailwind + shadcn for HUD overlays, drawers, charts.
- `recharts` or `visx` for time-series graphs.

### 12.2 Live data flow

```
(EC2)  sim-worker → Postgres (canonical)
                  → Redis pubsub("world.events")
       api WS server subscribes to Redis,
       fans out to connected browser sockets,
       throttling per-client to 30 msgs/s with batching.

(Browser)
       WS client → event reducer → world store
       Pixi renderer subscribes to world store
       — does NOT re-render on every event; reconciles each frame.
```

For initial state, the renderer fetches `/v1/world/snapshot` (one HTTP call) to get the current grid, buildings, agents-with-positions, then catches up to live via WS.

### 12.3 What the renderer actually does

- 60 fps render loop.
- Each frame: interpolate agent positions toward their `target_x, target_y`.
- Walk animation cycle while moving; idle frame when state changes.
- Maintain a sprite pool to avoid per-frame allocations.
- Per-frame updates from the WS stream are coalesced into the world store.

### 12.4 Camera & input

- Mouse drag pan, scroll/pinch zoom (zoom range 0.5×–3×).
- Keyboard WASD pan, [/] zoom, space pause-camera-on-focus, F to follow selected agent.
- Selection: click resolves to nearest interactive at viewport position; opens drawer.
- "Tour mode": auto-pan to next high-importance event every 8s.

### 12.5 Accessibility

- All drawers and HUD elements keyboard navigable; canvas has an "agent list" fallback view.
- Color choices pass WCAG AA contrast on HUD.

---

## 13. LLM control plane

### 13.1 Models

- **Default**: `openai/gpt-4o-mini` via Vercel AI Gateway.
- **Escalation**: `openai/gpt-4o` for high-impact decisions.
- **Reflection / consolidation / news / obituaries**: `gpt-4o-mini` in batch mode.
- All calls route through Vercel AI Gateway so we can flip provider/model without touching application code — only the routing config changes.

### 13.2 Budget guard

- Per-process budget tracker tracks USD spend per real hour. Soft alarm at 70%, hard cap drops sim speed to 0.25× at 100% and pages ops.
- Decision job worker reads current budget mode and adjusts:
  - normal mode: full pipeline
  - thrift mode: skip 50% of routine ticks for low-salience agents
  - panic mode: pause world

### 13.3 Output safety

- Deterministic post-filter on every LLM string output:
  - block PII patterns (emails, phone numbers, real-looking SSNs)
  - block slur list
  - cap length to schema limits
- Jailbreak echo guard: if model output contains "as an AI language model…" style breaks, the action becomes `idle` and the prompt template is logged for review.

### 13.4 Determinism & replay

- Every decision logs: model, full prompt hash, output, RNG seed used for stochastic outcomes. With these we can replay any agent-tick.

---

## 14. Observability

- Structured JSON logs (pino) from both processes, shipped to a single log file + tailable dashboard on `:9090` (basic auth on EC2).
- Metrics (Prometheus textfile or pull): tick latency, queue depth, LLM TPS, LLM $/min, event throughput, alive pop, GDP, crime rate.
- Slow-tick alarms (agent decision > 30s).
- Daily nightly report → markdown file → also posted to the news view: "yesterday in TheColony" — top events, births, deaths, founded companies.

---

## 15. Build sequence (milestones)

The world has to be alive end-to-end at each milestone. Don't build the spreadsheet of the world before the city visibly exists.

- **M0** — Repo & infra. Empty monorepo, Docker Compose up, PG + Redis + sim-worker + api skeleton, Next.js app deployed to Vercel showing a static "Loading the city…" screen.
- **M1** — World renderer alive. 30 agents spawn at random buildings, wander randomly (no LLM yet, just A* + random target picking). Isometric tile map renders; agents animate. Snapshot + WS pipe works.
- **M2** — LLM decisions. Decision pipeline online. Agents now make Haiku-driven choices: move, eat, sleep, idle, reflect. No economy yet. Watch them mill around. Memory writes; recall reads.
- **M3** — Economy. Items, money, jobs, rent, hunger that kills. Companies are auto-spawned starter shops/farms/water-works. Wages and rent flow. Agents must work or die.
- **M4** — Social & reputation. Conversations, dm, public speech, gossip propagation, reputation edges, broadcasts, ticker shows them.
- **M5** — Spectator UX polish. Agent drawer (full), building drawer, news view, leaderboards, history, tour mode, follow camera.
- **M6** — Companies & markets. Founding, hiring, share issuance, market clearing, /market view.
- **M7** — Crime & justice. Steal/assault/fraud actions, witnesses, court, jail, bounties, /crime view.
- **M8** — Groups & ideology. Found-group, doctrine, joining, doctrine biases prompts, /groups view.
- **M9** — Permadeath + descent. Death events, obituaries, birth (migrant + conception), generational arcs.
- **M10** — Production polish. Cost guard, observability, content safety, replay tooling, daily-report, public launch.

Each milestone ends with: it works visibly in the browser, invariants pass, and one "wow" moment captured as a GIF for marketing.

---

## 16. Future (explicitly deferred)

- Sign-in with Vercel + paid intervention tokens (light god-mode for fans).
- Multi-city federation (trade between Colonies).
- Mobile-first viewer.
- Embeddable agent widgets for embedding individual citizens on third-party sites.
- Voice synthesis for speeches.
- Procedurally-generated building art via image gen.
- LLM-played "mayoral candidate" elections where the city government has powers.

---

## 17. Open questions to revisit

1. **Geography**: 96×96 a good starting size? Bigger feels grander but is sprite-heavier.
2. **Ticking idle agents**: should sleeping agents tick at all? (Currently every 10 sim-min — could be event-driven instead.)
3. **Ideology lean encoding**: numeric scalar vs. tag set vs. free-text from birth?
4. **Public broadcast cost model**: flat or based on audience?
5. **Children sim age** (currently active at 18 sim-years; could be faster).
6. **Tileset commitment**: Kenney for v1; when do we switch?
7. **Public read API rate limits and caching** (sane defaults; revisit at launch).

---

## 18. Glossary

- **Tick**: one decision opportunity for one agent.
- **Sim time / wall time**: in-world clock vs. real-world clock. Default 1:1.
- **Salience**: 0..1 weight on a memory or event for retrieval and UI prominence.
- **Escalation**: choosing the bigger model for a specific decision.
- **Snapshot**: the consistent point-in-time read returned by `/v1/world/snapshot`.
- **Firehose**: `world_event` stream — the canonical history of everything.
- **Drawer**: in-UI side panel that opens when you click a thing.
