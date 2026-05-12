import { db, schema } from '@thecolony/db';
import { sql, eq, and, ne, lt, isNull, lte } from 'drizzle-orm';
import { decide } from '@thecolony/llm';
import type { Action, Agent } from '@thecolony/domain';
import { mulberry32, hashStringSeed } from '@thecolony/sim';
import { writeEvent } from './event-writer';
import { log } from './log';
import { shareAsset, tickerForCompany } from './market';
import { roleForIndustry, wageForRole } from './workforce';
import { accuseAgent, createIncident } from './justice';
import { foundGroup, joinGroup, leaveGroup, loadGroupContext } from './groups';
import { markAgentDead } from './lifecycle';
import { recordAgentDecisionLog } from './decision-log';
import { proposeBuilding } from './construction';

const TICK_INTERVAL_MS = 60 * 1000; // 60s real seconds between decisions

interface BuildingRow {
  id: string;
  kind: string;
  name: string;
  tile_x: number;
  tile_y: number;
  tile_w?: number;
  tile_h?: number;
}

export async function tickDueAgents(now: Date, maxAgents = 6): Promise<number> {
  const rows = await db
    .select()
    .from(schema.agent)
    .where(
      and(
        sql`${schema.agent.status} IN ('alive', 'jailed')`,
        lte(schema.agent.next_decision_at, now),
        ne(schema.agent.state, 'walking'),
      ),
    )
    .orderBy(schema.agent.next_decision_at)
    .limit(maxAgents);

  let processed = 0;
  for (const row of rows) {
    try {
      if (row.status === 'jailed') {
        await db
          .update(schema.agent)
          .set({
            state: 'jailed',
            next_decision_at: new Date(Date.now() + TICK_INTERVAL_MS),
            updated_at: new Date(),
          })
          .where(eq(schema.agent.id, row.id));
        await writeEvent({
          kind: 'agent_reflected',
          actor_ids: [row.id],
          importance: 1,
          payload: { context: 'jailed' },
        });
        processed++;
        continue;
      }
      await tickOne(row as unknown as Agent);
      processed++;
    } catch (e) {
      log.warn({ err: (e as Error).message, agent: row.id }, 'agent tick failed');
    }
  }
  return processed;
}

async function tickOne(agentRow: Agent): Promise<void> {
  const buildings = await db.select().from(schema.building);
  const decisionTime = new Date();
  const rngSeed = hashStringSeed(`${agentRow.id}:${decisionTime.toISOString()}`);
  const ctx = await buildContext(agentRow, buildings as unknown as BuildingRow[], rngSeed);
  const decision = await decide({ agent: agentRow, context: ctx });
  await recordAgentDecisionLog({
    agent: agentRow,
    context: ctx,
    decision,
    rngSeed,
    t: decisionTime,
  });
  await applyAction(agentRow, decision.action, buildings as unknown as BuildingRow[]);

  // schedule next decision
  const jitter = Math.floor(Math.random() * 20_000) - 10_000;
  await db
    .update(schema.agent)
    .set({
      next_decision_at: new Date(Date.now() + TICK_INTERVAL_MS + jitter),
      updated_at: new Date(),
    })
    .where(eq(schema.agent.id, agentRow.id));
}

async function buildContext(agent: Agent, allBuildings: BuildingRow[], rngSeed: number) {
  // nearest buildings
  const buildings = allBuildings
    .map((b) => ({ b, d: Math.hypot(b.tile_x - agent.pos_x, b.tile_y - agent.pos_y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 12)
    .map(({ b }) => ({
      id: b.id,
      kind: b.kind,
      name: b.name,
      tile_x: b.tile_x,
      tile_y: b.tile_y,
    }));

  const nearbyAgents = await db.execute<{
    id: string;
    name: string;
    pos_x: number;
    pos_y: number;
  }>(sql`
    SELECT id, name, pos_x, pos_y
    FROM ${schema.agent}
    WHERE status = 'alive' AND id <> ${agent.id}
    ORDER BY ((pos_x - ${agent.pos_x})^2 + (pos_y - ${agent.pos_y})^2) ASC
    LIMIT 5
  `);

  const [job] = await db.execute<{
    id: string;
    role: string;
    wage_cents: number;
    company_id: string;
    company_name: string;
    industry: string | null;
    building_id: string | null;
    building_name: string | null;
    tile_x: number | null;
    tile_y: number | null;
    tile_w: number | null;
    tile_h: number | null;
  }>(sql`
    SELECT j.id, j.role, j.wage_cents, c.id AS company_id, c.name AS company_name, c.industry,
      b.id AS building_id, b.name AS building_name, b.tile_x, b.tile_y, b.tile_w, b.tile_h
    FROM ${schema.job} j
    JOIN ${schema.company} c ON c.id = j.company_id
    LEFT JOIN ${schema.building} b ON b.id = c.building_id
    WHERE j.agent_id = ${agent.id} AND j.ended_at IS NULL
    LIMIT 1
  `);

  const ownedCompany = await db
    .select({
      id: schema.company.id,
      name: schema.company.name,
      industry: schema.company.industry,
      treasury_cents: schema.company.treasury_cents,
    })
    .from(schema.company)
    .where(eq(schema.company.founder_id, agent.id))
    .limit(1);
  const groupContext = await loadGroupContext(agent);

  let hireCandidateId: string | null = null;
  let hireRole: string | null = null;
  let fireCandidateId: string | null = null;
  let companyWorkerCount = 0;
  if (ownedCompany[0]) {
    const workerCount = await db.execute<{ n: number }>(
      sql`SELECT COUNT(*)::int AS n FROM ${schema.job} WHERE company_id=${ownedCompany[0].id} AND ended_at IS NULL`,
    );
    companyWorkerCount = Number(workerCount[0]?.n ?? 0);
    if (companyWorkerCount < 5) {
      const candidates = await db.execute<{ id: string; occupation: string | null }>(sql`
        SELECT a.id, a.occupation
        FROM ${schema.agent} a
        LEFT JOIN ${schema.job} j ON j.agent_id = a.id AND j.ended_at IS NULL
        WHERE a.status = 'alive'
          AND a.id <> ${agent.id}
          AND j.id IS NULL
        ORDER BY ((a.pos_x - ${agent.pos_x})^2 + (a.pos_y - ${agent.pos_y})^2) ASC
        LIMIT 1
      `);
      hireCandidateId = candidates[0]?.id ?? null;
      hireRole = candidates[0]?.occupation?.toLowerCase() ?? 'worker';
    }
    const fireCandidates = await db.execute<{ id: string }>(sql`
      SELECT a.id
      FROM ${schema.job} j
      JOIN ${schema.agent} a ON a.id = j.agent_id
      WHERE j.company_id = ${ownedCompany[0].id}
        AND j.ended_at IS NULL
        AND a.id <> ${agent.id}
        AND a.status = 'alive'
      ORDER BY j.wage_cents DESC, j.started_at DESC
      LIMIT 1
    `);
    fireCandidateId = fireCandidates[0]?.id ?? null;
  }

  const foodInv = await db.execute<{ qty: number }>(
    sql`SELECT COALESCE(qty,0) AS qty FROM ${schema.inventory} WHERE owner_kind='agent' AND owner_id=${agent.id} AND item_id=1`,
  );

  const marketAssets = await db.execute<{
    company_id: string;
    asset: string;
    ticker: string;
    last_price_cents: number;
    best_ask_cents: number | null;
    best_bid_cents: number | null;
  }>(sql`
    SELECT c.id AS company_id,
      ('shares:' || c.id::text) AS asset,
      COALESCE(c.ticker, 'COL') AS ticker,
      COALESCE(
        (
          SELECT po.price_cents
          FROM ${schema.price_observation} po
          WHERE po.asset = ('shares:' || c.id::text)
          ORDER BY po.t DESC
          LIMIT 1
        ),
        120
      )::bigint AS last_price_cents,
      (
        SELECT MIN(o.price_cents)
        FROM ${schema.market_order} o
        WHERE o.asset = ('shares:' || c.id::text)
          AND o.kind = 'sell'
          AND o.status IN ('open','partial')
          AND o.qty > o.filled_qty
      )::bigint AS best_ask_cents,
      (
        SELECT MAX(o.price_cents)
        FROM ${schema.market_order} o
        WHERE o.asset = ('shares:' || c.id::text)
          AND o.kind = 'buy'
          AND o.status IN ('open','partial')
          AND o.qty > o.filled_qty
      )::bigint AS best_bid_cents
    FROM ${schema.company} c
    WHERE c.dissolved_at IS NULL AND c.ticker IS NOT NULL AND c.building_id IS NOT NULL
    ORDER BY c.treasury_cents DESC
    LIMIT 8
  `);

  const shareHoldings = await db.execute<{ company_id: string; asset: string; shares: number }>(sql`
    SELECT sh.company_id,
      ('shares:' || sh.company_id::text) AS asset,
      sh.shares
    FROM ${schema.share_holding} sh
    WHERE sh.agent_id = ${agent.id} AND sh.shares > 0
    ORDER BY sh.shares DESC
    LIMIT 8
  `);

  // nearest rich agent (balance > $20) — for stealing
  const richRow = await db.execute<{ id: string; balance_cents: number }>(sql`
    SELECT id, balance_cents
    FROM ${schema.agent}
    WHERE status = 'alive' AND id <> ${agent.id} AND balance_cents > 2000
    ORDER BY ((pos_x - ${agent.pos_x})^2 + (pos_y - ${agent.pos_y})^2) ASC
    LIMIT 1
  `);
  const nearbyRich = richRow[0]?.id ?? null;

  const wantedRow = await db.execute<{
    agent_id: string;
    incident_id: string;
    charge: string;
    bounty_cents: number;
  }>(sql`
    SELECT a.id AS agent_id, i.id AS incident_id, i.kind AS charge, l.bounty_cents
    FROM ${schema.legal_status} l
    JOIN ${schema.agent} a ON a.id = l.agent_id
    JOIN ${schema.incident} i ON i.perp_id = a.id AND i.resolved = false
    WHERE a.status = 'alive'
      AND a.id <> ${agent.id}
      AND l.bounty_cents > 0
      AND NOT EXISTS (
        SELECT 1
        FROM ${schema.world_event} e
        WHERE e.kind = 'agent_accused'
          AND e.payload->>'incident_id' = i.id::text
          AND e.actor_ids[1] = ${agent.id}::uuid
      )
    ORDER BY ((a.pos_x - ${agent.pos_x})^2 + (a.pos_y - ${agent.pos_y})^2) ASC, l.bounty_cents DESC
    LIMIT 1
  `);
  const wanted = wantedRow[0] ?? null;

  // are we currently inside a food-selling workplace footprint?
  const shopHere = allBuildings.find(
    (b) =>
      (b.kind === 'shop' || b.kind === 'restaurant' || b.kind === 'farm') &&
      agent.pos_x >= b.tile_x &&
      agent.pos_x <= b.tile_x + (b.tile_w ?? 2) &&
      agent.pos_y >= b.tile_y &&
      agent.pos_y <= b.tile_y + (b.tile_h ?? 2),
  );

  return {
    buildings,
    nearby_agents: nearbyAgents.map((a) => ({
      id: a.id,
      name: a.name,
      distance: Math.hypot(a.pos_x - agent.pos_x, a.pos_y - agent.pos_y),
    })),
    has_job: Boolean(job),
    job_role: job?.role ?? null,
    job_company: job?.company_name ?? null,
    job_industry: job?.industry ?? null,
    job_building_id: job?.building_id ?? null,
    job_building: job?.building_name ?? null,
    job_wage_cents: job ? Number(job.wage_cents) : null,
    has_home: !!agent.home_id,
    food_qty: Number(foodInv[0]?.qty ?? 0),
    rng: mulberry32(rngSeed),
    nearby_rich_agent_id: nearbyRich,
    at_shop_id: shopHere?.id ?? null,
    owned_company_id: ownedCompany[0]?.id ?? null,
    hire_candidate_id: hireCandidateId,
    hire_role: hireRole,
    fire_candidate_id: fireCandidateId,
    company_worker_count: companyWorkerCount,
    company_treasury_cents: Number(ownedCompany[0]?.treasury_cents ?? 0),
    ...groupContext,
    wanted_agent_id: wanted?.agent_id ?? null,
    wanted_incident_id: wanted?.incident_id ?? null,
    wanted_charge: wanted?.charge ?? null,
    bounty_cents: wanted ? Number(wanted.bounty_cents) : 0,
    market_assets: marketAssets.map((asset) => ({
      ...asset,
      last_price_cents: Number(asset.last_price_cents),
      best_ask_cents: asset.best_ask_cents === null ? null : Number(asset.best_ask_cents),
      best_bid_cents: asset.best_bid_cents === null ? null : Number(asset.best_bid_cents),
    })),
    share_holdings: shareHoldings.map((holding) => ({
      ...holding,
      shares: Number(holding.shares),
    })),
  };
}

export async function applyAction(
  agent: Agent,
  action: Action,
  allBuildings: BuildingRow[],
): Promise<void> {
  switch (action.kind) {
    case 'idle':
      await db.update(schema.agent).set({ state: 'idle' }).where(eq(schema.agent.id, agent.id));
      return;
    case 'sleep':
      await db.update(schema.agent).set({ state: 'sleeping' }).where(eq(schema.agent.id, agent.id));
      await writeEvent({ kind: 'agent_slept', actor_ids: [agent.id], importance: 1 });
      return;
    case 'eat': {
      const qty = action.food_qty ?? 1;
      const food = await db.execute<{ qty: number }>(
        sql`SELECT COALESCE(qty,0) AS qty FROM ${schema.inventory} WHERE owner_kind='agent' AND owner_id=${agent.id} AND item_id=1`,
      );
      const have = Number(food[0]?.qty ?? 0);
      if (have < qty) return; // no food, skip
      await db.execute(sql`
        UPDATE ${schema.inventory} SET qty = qty - ${qty}
        WHERE owner_kind='agent' AND owner_id=${agent.id} AND item_id=1
      `);
      await db.execute(sql`
        UPDATE ${schema.agent}
        SET needs = jsonb_set(needs, '{hunger}', to_jsonb(GREATEST(0, (needs->>'hunger')::float - 35))),
            state = 'eating'
        WHERE id = ${agent.id}
      `);
      await writeEvent({
        kind: 'agent_ate',
        actor_ids: [agent.id],
        importance: 1,
        payload: { qty },
      });
      return;
    }
    case 'move': {
      const b = allBuildings.find((x) => x.id === action.to_building_id);
      if (!b) return;
      await db
        .update(schema.agent)
        .set({ target_x: b.tile_x + 0.5, target_y: b.tile_y + 0.5, state: 'walking' })
        .where(eq(schema.agent.id, agent.id));
      await writeEvent({
        kind: 'agent_moved',
        actor_ids: [agent.id],
        location_id: b.id,
        importance: 1,
        payload: { to: b.name },
      });
      return;
    }
    case 'speak': {
      await db.update(schema.agent).set({ state: 'speaking' }).where(eq(schema.agent.id, agent.id));
      await writeEvent({
        kind: 'agent_spoke',
        actor_ids: [agent.id],
        importance: 4,
        payload: { body: action.body, to: action.to },
      });
      // Positive social interaction: bump mutual affinity with nearest neighbours.
      // Empathic, sociable agents create stronger bonds; speech to 'nearby' only.
      if (action.to === 'nearby') {
        const neighbours = await db.execute<{ id: string }>(sql`
          SELECT id FROM ${schema.agent}
          WHERE status = 'alive' AND id <> ${agent.id}
            AND ((pos_x - ${agent.pos_x})^2 + (pos_y - ${agent.pos_y})^2) < 9
          ORDER BY ((pos_x - ${agent.pos_x})^2 + (pos_y - ${agent.pos_y})^2) ASC
          LIMIT 3
        `);
        const empathy = Number(agent.traits.empathy ?? 0.5);
        const sociability = Number(agent.traits.sociability ?? 0.5);
        const bump = Math.max(1, Math.round((empathy + sociability) * 3));
        for (const n of neighbours) {
          // Both directions; tag the edge.
          await db.execute(sql`
            INSERT INTO ${schema.agent_relationship} (subj_id, obj_id, affinity, trust, last_interaction_t, tags)
            VALUES (${agent.id}, ${n.id}, ${bump}, ${Math.floor(bump / 2)}, now(), ARRAY['acquaintance'])
            ON CONFLICT (subj_id, obj_id) DO UPDATE
              SET affinity = LEAST(100, ${schema.agent_relationship.affinity} + ${bump}),
                  trust    = LEAST(100, ${schema.agent_relationship.trust} + ${Math.floor(bump / 2)}),
                  last_interaction_t = now()
          `);
          await db.execute(sql`
            INSERT INTO ${schema.agent_relationship} (subj_id, obj_id, affinity, trust, last_interaction_t, tags)
            VALUES (${n.id}, ${agent.id}, ${bump}, ${Math.floor(bump / 2)}, now(), ARRAY['acquaintance'])
            ON CONFLICT (subj_id, obj_id) DO UPDATE
              SET affinity = LEAST(100, ${schema.agent_relationship.affinity} + ${bump}),
                  trust    = LEAST(100, ${schema.agent_relationship.trust} + ${Math.floor(bump / 2)}),
                  last_interaction_t = now()
          `);
        }
      }
      return;
    }
    case 'work': {
      const [job] = await db.execute<{
        company_id: string;
        company: string;
        role: string;
        wage_cents: number;
        building_id: string | null;
        building: string | null;
        tile_x: number | null;
        tile_y: number | null;
        tile_w: number | null;
        tile_h: number | null;
      }>(sql`
        SELECT j.company_id, c.name AS company, j.role, j.wage_cents,
          b.id AS building_id, b.name AS building, b.tile_x, b.tile_y, b.tile_w, b.tile_h
        FROM ${schema.job} j
        JOIN ${schema.company} c ON c.id = j.company_id
        LEFT JOIN ${schema.building} b ON b.id = c.building_id
        WHERE j.agent_id = ${agent.id} AND j.ended_at IS NULL
        LIMIT 1
      `);
      if (!job) return;
      const atWorkplace =
        job.building_id && job.tile_x !== null && job.tile_y !== null
          ? agent.pos_x >= Number(job.tile_x) &&
            agent.pos_x <= Number(job.tile_x) + Number(job.tile_w ?? 2) &&
            agent.pos_y >= Number(job.tile_y) &&
            agent.pos_y <= Number(job.tile_y) + Number(job.tile_h ?? 2)
          : false;

      if (job.building_id && job.tile_x !== null && job.tile_y !== null && !atWorkplace) {
        await db
          .update(schema.agent)
          .set({
            target_x: Number(job.tile_x) + 0.5,
            target_y: Number(job.tile_y) + 0.5,
            state: 'walking',
          })
          .where(eq(schema.agent.id, agent.id));
        await writeEvent({
          kind: 'agent_commuted',
          actor_ids: [agent.id, job.company_id],
          location_id: job.building_id,
          importance: 2,
          payload: { company: job.company, role: job.role, building: job.building },
        });
        return;
      }

      await db.update(schema.agent).set({ state: 'working' }).where(eq(schema.agent.id, agent.id));
      await writeEvent({
        kind: 'agent_worked',
        actor_ids: [agent.id, job.company_id],
        location_id: job.building_id,
        importance: 2,
        payload: {
          company: job.company,
          role: job.role,
          wage_cents: Number(job.wage_cents),
          building: job.building,
        },
      });
      return;
    }
    case 'seek_job': {
      const desired = (agent.occupation ?? '').toLowerCase();
      const companies = await db.execute<{
        id: string;
        name: string;
        industry: string | null;
        treasury_cents: number;
        has_posting: boolean;
        workers: number;
      }>(sql`
        WITH worker_stats AS (
          SELECT company_id, COUNT(*)::int AS workers
          FROM ${schema.job}
          WHERE ended_at IS NULL
          GROUP BY company_id
        )
        SELECT c.id, c.name, c.industry, c.treasury_cents,
          COALESCE(ws.workers, 0)::int AS workers,
          EXISTS (
            SELECT 1
            FROM ${schema.world_event} e
            WHERE e.kind = 'job_posted'
              AND e.payload->>'company_id' = c.id::text
              AND e.t > now() - interval '30 minutes'
          ) AS has_posting
        FROM ${schema.company} c
        LEFT JOIN worker_stats ws ON ws.company_id = c.id
        WHERE c.dissolved_at IS NULL AND c.building_id IS NOT NULL
        ORDER BY
          has_posting DESC,
          CASE
            WHEN lower(coalesce(c.industry, '')) = ${desired} THEN 0
            WHEN ${desired} LIKE '%' || lower(coalesce(c.industry, '')) || '%' THEN 1
            ELSE 2
          END,
          c.treasury_cents DESC
        LIMIT 30
      `);
      for (const c of companies) {
        if (Number(c.workers) < 5) {
          const role = agent.occupation?.toLowerCase() ?? roleForIndustry(c.industry);
          const wage_cents = c.has_posting
            ? wageForRole(role)
            : wageForOccupation(agent.occupation);
          await db.insert(schema.job).values({
            agent_id: agent.id,
            company_id: c.id,
            role,
            wage_cents,
          });
          await db.execute(sql`
            INSERT INTO ${schema.company_member} (agent_id, company_id, role)
            VALUES (${agent.id}, ${c.id}, 'worker')
            ON CONFLICT DO NOTHING
          `);
          await db
            .update(schema.agent)
            .set({ employer_id: c.id, occupation: agent.occupation ?? c.industry ?? 'worker' })
            .where(eq(schema.agent.id, agent.id));
          await writeEvent({
            kind: 'agent_hired',
            actor_ids: [agent.id, c.id],
            importance: 5,
            payload: { role, wage_cents, company: c.name, matched_posting: c.has_posting },
          });
          return;
        }
      }
      return;
    }
    case 'hire': {
      const [owned] = await db
        .select()
        .from(schema.company)
        .where(eq(schema.company.founder_id, agent.id))
        .limit(1);
      if (!owned) return;
      const [target] = await db
        .select()
        .from(schema.agent)
        .where(eq(schema.agent.id, action.agent_id))
        .limit(1);
      if (!target || target.status !== 'alive') return;
      const existing = await db
        .select()
        .from(schema.job)
        .where(and(eq(schema.job.agent_id, target.id), isNull(schema.job.ended_at)))
        .limit(1);
      if (existing.length) return;
      await db.insert(schema.job).values({
        agent_id: target.id,
        company_id: owned.id,
        role: action.role,
        wage_cents: Math.max(1000, Math.min(6000, action.wage_cents)),
      });
      await db.execute(sql`
        INSERT INTO ${schema.company_member} (agent_id, company_id, role)
        VALUES (${target.id}, ${owned.id}, 'worker')
        ON CONFLICT DO NOTHING
      `);
      await db
        .update(schema.agent)
        .set({ employer_id: owned.id, occupation: target.occupation ?? action.role })
        .where(eq(schema.agent.id, target.id));
      await writeEvent({
        kind: 'agent_hired',
        actor_ids: [target.id, agent.id, owned.id],
        importance: 6,
        payload: {
          role: action.role,
          wage_cents: action.wage_cents,
          company: owned.name,
          hired_by: agent.name,
        },
      });
      return;
    }
    case 'fire': {
      const [owned] = await db
        .select()
        .from(schema.company)
        .where(eq(schema.company.founder_id, agent.id))
        .limit(1);
      if (!owned) return;
      const [job] = await db
        .select()
        .from(schema.job)
        .where(
          and(
            eq(schema.job.company_id, owned.id),
            eq(schema.job.agent_id, action.agent_id),
            isNull(schema.job.ended_at),
          ),
        )
        .limit(1);
      if (!job || job.agent_id === agent.id) return;
      await db.update(schema.job).set({ ended_at: new Date() }).where(eq(schema.job.id, job.id));
      await db
        .update(schema.agent)
        .set({ employer_id: null, state: 'idle' })
        .where(eq(schema.agent.id, job.agent_id));
      await writeEvent({
        kind: 'agent_fired',
        actor_ids: [job.agent_id, agent.id, owned.id],
        importance: 7,
        payload: {
          company: owned.name,
          role: job.role,
          fired_by: agent.name,
          reason: Number(owned.treasury_cents) < 25_000 ? 'cash pressure' : 'owner discretion',
        },
      });
      return;
    }
    case 'found_company': {
      const capital = Math.max(1000, Math.min(action.capital_cents, Number(agent.balance_cents)));
      if (capital < 1000) return;
      const industry = String(action.charter.industry ?? 'office');
      const workplace = await findVacantWorkplace(industry, agent, allBuildings);
      if (!workplace) return;
      await db
        .update(schema.agent)
        .set({ balance_cents: sql`${schema.agent.balance_cents} - ${capital}` })
        .where(eq(schema.agent.id, agent.id));
      const [company] = await db
        .insert(schema.company)
        .values({
          name: action.name,
          founder_id: agent.id,
          charter: action.charter,
          treasury_cents: capital,
          building_id: workplace.id,
          industry,
        })
        .returning({ id: schema.company.id, name: schema.company.name });
      if (!company) return;
      const ticker = tickerForCompany(company.name, company.id);
      await db.update(schema.company).set({ ticker }).where(eq(schema.company.id, company.id));
      await db.insert(schema.job).values({
        agent_id: agent.id,
        company_id: company.id,
        role: 'founder',
        wage_cents: 0,
      });
      await db.execute(sql`
        INSERT INTO ${schema.company_member} (agent_id, company_id, role)
        VALUES (${agent.id}, ${company.id}, 'founder'), (${agent.id}, ${company.id}, 'exec'), (${agent.id}, ${company.id}, 'shareholder')
        ON CONFLICT DO NOTHING
      `);
      await db.execute(sql`
        INSERT INTO ${schema.share_holding} (agent_id, company_id, shares)
        VALUES (${agent.id}, ${company.id}, 1000)
        ON CONFLICT (agent_id, company_id) DO UPDATE
          SET shares = ${schema.share_holding.shares} + EXCLUDED.shares,
              updated_at = now()
      `);
      await db
        .update(schema.agent)
        .set({ employer_id: company.id })
        .where(eq(schema.agent.id, agent.id));
      await db.insert(schema.ledger_entry).values({
        debit_kind: 'agent',
        debit_id: agent.id,
        credit_kind: 'company',
        credit_id: company.id,
        amount_cents: capital,
        reason: 'company_capital',
      });
      await writeEvent({
        kind: 'company_founded',
        actor_ids: [agent.id, company.id],
        location_id: workplace.id,
        importance: 8,
        payload: { name: company.name, ticker, capital_cents: capital, building: workplace.name },
      });
      await writeEvent({
        kind: 'shares_issued',
        actor_ids: [agent.id, company.id],
        importance: 7,
        payload: { company: company.name, ticker, shares: 1000, price_cents: 100 },
      });
      return;
    }
    case 'issue_shares': {
      const [company] = await db
        .select()
        .from(schema.company)
        .where(eq(schema.company.id, action.company_id))
        .limit(1);
      if (!company || company.founder_id !== agent.id || company.dissolved_at) return;
      const shares = Math.max(1, Math.min(2500, action.shares));
      const ticker = company.ticker ?? tickerForCompany(company.name, company.id);
      if (!company.ticker)
        await db.update(schema.company).set({ ticker }).where(eq(schema.company.id, company.id));
      await db.execute(sql`
        INSERT INTO ${schema.share_holding} (agent_id, company_id, shares)
        VALUES (${agent.id}, ${company.id}, ${shares})
        ON CONFLICT (agent_id, company_id) DO UPDATE
          SET shares = ${schema.share_holding.shares} + EXCLUDED.shares,
              updated_at = now()
      `);
      await db.execute(sql`
        INSERT INTO ${schema.company_member} (agent_id, company_id, role)
        VALUES (${agent.id}, ${company.id}, 'shareholder')
        ON CONFLICT DO NOTHING
      `);
      await db.insert(schema.market_order).values({
        kind: 'sell',
        asset: shareAsset(company.id),
        agent_id: agent.id,
        ref_id: company.id,
        price_cents: action.price_cents,
        qty: Math.min(50, shares),
        ttl_t: new Date(Date.now() + 30 * 60_000),
      });
      await writeEvent({
        kind: 'shares_issued',
        actor_ids: [agent.id, company.id],
        importance: 7,
        payload: { company: company.name, ticker, shares, price_cents: action.price_cents },
      });
      return;
    }
    case 'place_order': {
      const companyId = companyIdFromShareAsset(action.asset);
      if (!companyId) return;
      const [company] = await db
        .select()
        .from(schema.company)
        .where(eq(schema.company.id, companyId))
        .limit(1);
      if (!company || company.dissolved_at) return;
      const qty = Math.max(1, Math.min(100, action.qty));
      const price = Math.max(1, Math.min(100_000, action.price_cents));

      if (action.side === 'buy' && Number(agent.balance_cents) < qty * price) return;
      if (action.side === 'sell') {
        const owned = await db.execute<{ shares: number }>(sql`
          SELECT shares FROM ${schema.share_holding}
          WHERE agent_id = ${agent.id} AND company_id = ${company.id}
          LIMIT 1
        `);
        const openSell = await db.execute<{ qty: number }>(sql`
          SELECT COALESCE(SUM(qty - filled_qty), 0)::int AS qty
          FROM ${schema.market_order}
          WHERE agent_id = ${agent.id}
            AND ref_id = ${company.id}
            AND kind = 'sell'
            AND status IN ('open','partial')
        `);
        if (Number(owned[0]?.shares ?? 0) - Number(openSell[0]?.qty ?? 0) < qty) return;
      }

      await db.insert(schema.market_order).values({
        kind: action.side,
        asset: shareAsset(company.id),
        agent_id: agent.id,
        ref_id: company.id,
        price_cents: price,
        qty,
        ttl_t: new Date(Date.now() + 15 * 60_000),
      });
      await db.update(schema.agent).set({ state: 'trading' }).where(eq(schema.agent.id, agent.id));
      await writeEvent({
        kind: 'order_placed',
        actor_ids: [agent.id, company.id],
        importance: 4,
        payload: {
          side: action.side,
          asset: shareAsset(company.id),
          ticker: company.ticker ?? tickerForCompany(company.name, company.id),
          qty,
          price_cents: price,
        },
      });
      return;
    }
    case 'rent': {
      const b = allBuildings.find((x) => x.id === action.building_id);
      if (!b) return;
      if (b.kind !== 'house' && b.kind !== 'apartment') return;
      await db.update(schema.agent).set({ home_id: b.id }).where(eq(schema.agent.id, agent.id));
      await writeEvent({
        kind: 'agent_homed',
        actor_ids: [agent.id],
        location_id: b.id,
        importance: 5,
        payload: { building: b.name },
      });
      return;
    }
    case 'reflect':
      await writeEvent({ kind: 'agent_reflected', actor_ids: [agent.id], importance: 1 });
      return;
    case 'buy': {
      if (action.item !== 'food') return;
      const price = Math.min(action.max_price_cents, 300);
      if (Number(agent.balance_cents) < price) return;
      // find any local food company with food in stock
      const shops = await db.execute<{ company_id: string; company_name: string; building_id: string | null; qty: number }>(sql`
        SELECT c.id AS company_id, c.name AS company_name, c.building_id, i.qty AS qty
        FROM ${schema.company} c
        JOIN ${schema.inventory} i
          ON i.owner_kind = 'company' AND i.owner_id = c.id AND i.item_id = 1
        WHERE c.industry IN ('shop','farm','restaurant') AND i.qty > 0
        ORDER BY i.qty DESC
        LIMIT 1
      `);
      const shop = shops[0];
      if (!shop) return;
      const qty = Math.min(action.qty, Number(shop.qty));
      const total = price * qty;
      await db.execute(sql`
        UPDATE ${schema.inventory} SET qty = qty - ${qty}
        WHERE owner_kind='company' AND owner_id=${shop.company_id} AND item_id=1
      `);
      await db.execute(sql`
        INSERT INTO ${schema.inventory} (owner_kind, owner_id, item_id, qty)
        VALUES ('agent', ${agent.id}, 1, ${qty})
        ON CONFLICT (owner_kind, owner_id, item_id) DO UPDATE SET qty = ${schema.inventory.qty} + EXCLUDED.qty
      `);
      await db
        .update(schema.agent)
        .set({ balance_cents: sql`${schema.agent.balance_cents} - ${total}` })
        .where(eq(schema.agent.id, agent.id));
      await db
        .update(schema.company)
        .set({ treasury_cents: sql`${schema.company.treasury_cents} + ${total}` })
        .where(eq(schema.company.id, shop.company_id));
      await db.insert(schema.ledger_entry).values({
        debit_kind: 'agent',
        debit_id: agent.id,
        credit_kind: 'company',
        credit_id: shop.company_id,
        amount_cents: total,
        reason: 'purchase',
      });
      await writeEvent({
        kind: 'agent_bought',
        actor_ids: [agent.id, shop.company_id],
        location_id: shop.building_id,
        importance: 2,
        payload: {
          item: 'food',
          qty,
          amount_cents: total,
          unit_price_cents: price,
          company: shop.company_name,
        },
      });
      return;
    }
    case 'steal': {
      const targetId = action.target_agent_id;
      const [target] = await db
        .select()
        .from(schema.agent)
        .where(eq(schema.agent.id, targetId))
        .limit(1);
      if (!target || target.status !== 'alive') return;
      const loot = Math.min(Number(target.balance_cents), 500 + Math.floor(Math.random() * 1500));
      if (loot <= 0) return;
      await db
        .update(schema.agent)
        .set({ balance_cents: sql`${schema.agent.balance_cents} - ${loot}` })
        .where(eq(schema.agent.id, targetId));
      await db
        .update(schema.agent)
        .set({ balance_cents: sql`${schema.agent.balance_cents} + ${loot}` })
        .where(eq(schema.agent.id, agent.id));
      await db.insert(schema.ledger_entry).values({
        debit_kind: 'agent',
        debit_id: targetId,
        credit_kind: 'agent',
        credit_id: agent.id,
        amount_cents: loot,
        reason: 'theft',
      });
      await createIncident({
        kind: 'theft',
        perp_id: agent.id,
        victim_id: targetId,
        severity: 2,
        amount_cents: loot,
        location_id: currentBuildingId(agent, allBuildings),
      });
      // mark relationship: victim's affinity toward perp tanks
      await db.execute(sql`
        INSERT INTO ${schema.agent_relationship} (subj_id, obj_id, affinity, trust, tags)
        VALUES (${targetId}, ${agent.id}, -60, -50, ARRAY['robbed_by'])
        ON CONFLICT (subj_id, obj_id) DO UPDATE
          SET affinity = LEAST(100, GREATEST(-100, ${schema.agent_relationship.affinity} - 60)),
              trust    = LEAST(100, GREATEST(-100, ${schema.agent_relationship.trust} - 50)),
              tags     = ARRAY['robbed_by']
      `);
      return;
    }
    case 'assault': {
      const [target] = await db
        .select()
        .from(schema.agent)
        .where(eq(schema.agent.id, action.target_agent_id))
        .limit(1);
      if (!target || target.status !== 'alive' || target.id === agent.id) return;
      const severity = Math.max(
        2,
        Math.min(5, Math.round(2 + agent.traits.risk * 3 - agent.traits.empathy)),
      );
      await createIncident({
        kind: 'assault',
        perp_id: agent.id,
        victim_id: target.id,
        severity,
        location_id: currentBuildingId(agent, allBuildings),
      });
      await db.execute(sql`
        INSERT INTO ${schema.agent_relationship} (subj_id, obj_id, affinity, trust, tags)
        VALUES (${target.id}, ${agent.id}, -70, -60, ARRAY['assaulted_by'])
        ON CONFLICT (subj_id, obj_id) DO UPDATE
          SET affinity = LEAST(100, GREATEST(-100, ${schema.agent_relationship.affinity} - 70)),
              trust    = LEAST(100, GREATEST(-100, ${schema.agent_relationship.trust} - 60)),
              tags     = ARRAY['assaulted_by']
      `);
      const lethalChance =
        severity >= 5
          ? Math.max(
              0.08,
              agent.traits.risk * 0.18 + agent.traits.greed * 0.08 - agent.traits.empathy * 0.08,
            )
          : 0;
      if (lethalChance > 0 && Math.random() < lethalChance) {
        await markAgentDead(target.id, 'violence');
      }
      return;
    }
    case 'fraud': {
      const [target] = await db
        .select()
        .from(schema.agent)
        .where(eq(schema.agent.id, action.target_agent_id))
        .limit(1);
      if (!target || target.status !== 'alive' || target.id === agent.id) return;
      const amount = Math.min(
        Number(target.balance_cents),
        Math.max(100, Math.min(action.amount_cents, 5000)),
      );
      if (amount <= 0) return;
      await db
        .update(schema.agent)
        .set({ balance_cents: sql`${schema.agent.balance_cents} - ${amount}` })
        .where(eq(schema.agent.id, target.id));
      await db
        .update(schema.agent)
        .set({ balance_cents: sql`${schema.agent.balance_cents} + ${amount}` })
        .where(eq(schema.agent.id, agent.id));
      await db.insert(schema.ledger_entry).values({
        debit_kind: 'agent',
        debit_id: target.id,
        credit_kind: 'agent',
        credit_id: agent.id,
        amount_cents: amount,
        reason: 'fraud',
      });
      await createIncident({
        kind: 'fraud',
        perp_id: agent.id,
        victim_id: target.id,
        severity: amount >= 3000 ? 4 : 3,
        amount_cents: amount,
        location_id: currentBuildingId(agent, allBuildings),
      });
      await db.execute(sql`
        INSERT INTO ${schema.agent_relationship} (subj_id, obj_id, affinity, trust, tags)
        VALUES (${target.id}, ${agent.id}, -45, -70, ARRAY['defrauded_by'])
        ON CONFLICT (subj_id, obj_id) DO UPDATE
          SET affinity = LEAST(100, GREATEST(-100, ${schema.agent_relationship.affinity} - 45)),
              trust    = LEAST(100, GREATEST(-100, ${schema.agent_relationship.trust} - 70)),
              tags     = ARRAY['defrauded_by']
      `);
      return;
    }
    case 'breach': {
      const [counterparty] = await db
        .select()
        .from(schema.agent)
        .where(eq(schema.agent.id, action.counterparty_id))
        .limit(1);
      if (!counterparty || counterparty.status !== 'alive' || counterparty.id === agent.id) return;
      await createIncident({
        kind: 'breach',
        perp_id: agent.id,
        victim_id: counterparty.id,
        severity: action.amount_cents >= 3000 ? 3 : 2,
        amount_cents: Math.max(0, Math.min(action.amount_cents, 10_000)),
        location_id: currentBuildingId(agent, allBuildings),
      });
      await db.execute(sql`
        INSERT INTO ${schema.agent_relationship} (subj_id, obj_id, affinity, trust, tags)
        VALUES (${counterparty.id}, ${agent.id}, -30, -40, ARRAY['contract_breached'])
        ON CONFLICT (subj_id, obj_id) DO UPDATE
          SET affinity = LEAST(100, GREATEST(-100, ${schema.agent_relationship.affinity} - 30)),
              trust    = LEAST(100, GREATEST(-100, ${schema.agent_relationship.trust} - 40)),
              tags     = ARRAY['contract_breached']
      `);
      return;
    }
    case 'accuse':
      if (action.target_agent_id !== agent.id) {
        await accuseAgent(
          agent.id,
          action.target_agent_id,
          action.charge,
          action.incident_id ?? null,
        );
      }
      return;
    case 'found_group':
      await foundGroup(agent, action);
      return;
    case 'join_group':
      await joinGroup(agent, action.group_id);
      return;
    case 'leave_group':
      await leaveGroup(agent, action.group_id);
      return;
    case 'propose_building': {
      await proposeBuilding(
        {
          id: agent.id,
          name: agent.name,
          balance_cents: Number(agent.balance_cents),
          pos_x: agent.pos_x,
          pos_y: agent.pos_y,
        },
        action.building_kind,
        action.capital_cents,
      );
      return;
    }
    default:
      // unimplemented v1 actions degrade to idle
      await db.update(schema.agent).set({ state: 'idle' }).where(eq(schema.agent.id, agent.id));
      return;
  }
}

function companyIdFromShareAsset(asset: string): string | null {
  return asset.startsWith('shares:') ? asset.slice('shares:'.length) : null;
}

async function findVacantWorkplace(
  industry: string,
  agent: Agent,
  allBuildings: BuildingRow[],
): Promise<BuildingRow | null> {
  const occupiedRows = await db.execute<{ building_id: string }>(sql`
    SELECT building_id
    FROM ${schema.company}
    WHERE dissolved_at IS NULL AND building_id IS NOT NULL
  `);
  const occupied = new Set(occupiedRows.map((row) => row.building_id));
  const allowed = workplaceKindsForIndustry(industry);
  const candidates = allBuildings
    .filter((building) => allowed.includes(building.kind))
    .sort((a, b) => distanceToAgent(a, agent) - distanceToAgent(b, agent));
  return candidates.find((building) => !occupied.has(building.id)) ?? candidates[0] ?? null;
}

function workplaceKindsForIndustry(industry: string): string[] {
  switch (industry) {
    case 'farm':
      return ['farm'];
    case 'factory':
      return ['factory'];
    case 'shop':
      return ['shop'];
    case 'bar':
      return ['bar'];
    case 'restaurant':
      return ['restaurant', 'shop'];
    case 'bank':
      return ['bank', 'office'];
    case 'clinic':
      return ['clinic'];
    case 'school':
      return ['school'];
    case 'newsroom':
      return ['newsroom', 'office'];
    case 'construction_yard':
      return ['construction_yard', 'factory'];
    case 'court':
      return ['court', 'town_hall', 'office'];
    case 'town_hall':
      return ['town_hall', 'office'];
    case 'water_works':
      return ['water_works'];
    case 'power_plant':
      return ['power_plant'];
    default:
      return ['office', 'shop', 'factory'];
  }
}

function distanceToAgent(building: BuildingRow, agent: Agent): number {
  return Math.hypot(building.tile_x - agent.pos_x, building.tile_y - agent.pos_y);
}

function currentBuildingId(agent: Agent, allBuildings: BuildingRow[]): string | null {
  const building = allBuildings.find(
    (b) =>
      agent.pos_x >= b.tile_x &&
      agent.pos_x <= b.tile_x + (b.tile_w ?? 2) &&
      agent.pos_y >= b.tile_y &&
      agent.pos_y <= b.tile_y + (b.tile_h ?? 2),
  );
  return building?.id ?? null;
}

function wageForOccupation(occupation: string | null | undefined): number {
  const text = (occupation ?? '').toLowerCase();
  if (text.includes('broker')) return 2800;
  if (text.includes('doctor')) return 2900;
  if (text.includes('engineer')) return 2400;
  if (text.includes('mechanic')) return 2200;
  if (text.includes('builder')) return 2200;
  if (text.includes('chef')) return 2000;
  if (text.includes('guard')) return 2000;
  if (text.includes('shopkeeper')) return 2100;
  if (text.includes('civil')) return 2000;
  if (text.includes('teacher')) return 1900;
  if (text.includes('reporter')) return 1800;
  if (text.includes('courier')) return 1600;
  return 1600;
}
