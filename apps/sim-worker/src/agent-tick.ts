import { db, schema } from '@thecolony/db';
import { sql, eq, and, ne, lt, isNull, lte } from 'drizzle-orm';
import { decide } from '@thecolony/llm';
import type { Action, Agent } from '@thecolony/domain';
import { mulberry32, hashStringSeed } from '@thecolony/sim';
import { writeEvent } from './event-writer';
import { log } from './log';

const TICK_INTERVAL_MS = 60 * 1000; // 60s real seconds between decisions

interface BuildingRow {
  id: string;
  kind: string;
  name: string;
  tile_x: number;
  tile_y: number;
}

export async function tickDueAgents(now: Date, maxAgents = 6): Promise<number> {
  const rows = await db
    .select()
    .from(schema.agent)
    .where(and(eq(schema.agent.status, 'alive'), lte(schema.agent.next_decision_at, now), ne(schema.agent.state, 'walking')))
    .orderBy(schema.agent.next_decision_at)
    .limit(maxAgents);

  let processed = 0;
  for (const row of rows) {
    try {
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
  const ctx = await buildContext(agentRow, buildings as unknown as BuildingRow[]);
  const decision = await decide({ agent: agentRow, context: ctx });
  await applyAction(agentRow, decision.action, buildings as unknown as BuildingRow[]);

  // schedule next decision
  const jitter = Math.floor(Math.random() * 20_000) - 10_000;
  await db
    .update(schema.agent)
    .set({ next_decision_at: new Date(Date.now() + TICK_INTERVAL_MS + jitter), updated_at: new Date() })
    .where(eq(schema.agent.id, agentRow.id));
}

async function buildContext(agent: Agent, allBuildings: BuildingRow[]) {
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

  const nearbyAgents = await db.execute<{ id: string; name: string; pos_x: number; pos_y: number }>(sql`
    SELECT id, name, pos_x, pos_y
    FROM ${schema.agent}
    WHERE status = 'alive' AND id <> ${agent.id}
    ORDER BY ((pos_x - ${agent.pos_x})^2 + (pos_y - ${agent.pos_y})^2) ASC
    LIMIT 5
  `);

  const job = await db
    .select()
    .from(schema.job)
    .where(and(eq(schema.job.agent_id, agent.id), isNull(schema.job.ended_at)))
    .limit(1);

  const foodInv = await db.execute<{ qty: number }>(
    sql`SELECT COALESCE(qty,0) AS qty FROM ${schema.inventory} WHERE owner_kind='agent' AND owner_id=${agent.id} AND item_id=1`,
  );

  // nearest rich agent (balance > $20) — for stealing
  const richRow = await db.execute<{ id: string; balance_cents: number }>(sql`
    SELECT id, balance_cents
    FROM ${schema.agent}
    WHERE status = 'alive' AND id <> ${agent.id} AND balance_cents > 2000
    ORDER BY ((pos_x - ${agent.pos_x})^2 + (pos_y - ${agent.pos_y})^2) ASC
    LIMIT 1
  `);
  const nearbyRich = richRow[0]?.id ?? null;

  // are we currently inside a shop's footprint?
  const shopHere = allBuildings.find(
    (b) =>
      b.kind === 'shop' &&
      agent.pos_x >= b.tile_x &&
      agent.pos_x <= b.tile_x + 2 &&
      agent.pos_y >= b.tile_y &&
      agent.pos_y <= b.tile_y + 2,
  );

  return {
    buildings,
    nearby_agents: nearbyAgents.map((a) => ({
      id: a.id,
      name: a.name,
      distance: Math.hypot(a.pos_x - agent.pos_x, a.pos_y - agent.pos_y),
    })),
    has_job: job.length > 0,
    has_home: !!agent.home_id,
    food_qty: Number(foodInv[0]?.qty ?? 0),
    rng: mulberry32(hashStringSeed(agent.id + Date.now().toString())),
    nearby_rich_agent_id: nearbyRich,
    at_shop_id: shopHere?.id ?? null,
  };
}

async function applyAction(agent: Agent, action: Action, allBuildings: BuildingRow[]): Promise<void> {
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
      await writeEvent({ kind: 'agent_ate', actor_ids: [agent.id], importance: 1, payload: { qty } });
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
      return;
    }
    case 'work': {
      const job = await db
        .select()
        .from(schema.job)
        .where(and(eq(schema.job.agent_id, agent.id), isNull(schema.job.ended_at)))
        .limit(1);
      if (!job.length) return;
      await db.update(schema.agent).set({ state: 'working' }).where(eq(schema.agent.id, agent.id));
      await writeEvent({ kind: 'agent_worked', actor_ids: [agent.id], importance: 1 });
      return;
    }
    case 'seek_job': {
      // find any company without a worker
      const companies = await db.select().from(schema.company).limit(20);
      for (const c of companies) {
        const workers = await db.execute<{ n: number }>(
          sql`SELECT COUNT(*)::int AS n FROM ${schema.job} WHERE company_id=${c.id} AND ended_at IS NULL`,
        );
        if (Number(workers[0]?.n ?? 0) < 3) {
          await db.insert(schema.job).values({
            agent_id: agent.id,
            company_id: c.id,
            role: 'worker',
            wage_cents: 1500,
          });
          await db
            .update(schema.agent)
            .set({ employer_id: c.id, occupation: c.industry ?? 'worker' })
            .where(eq(schema.agent.id, agent.id));
          await writeEvent({
            kind: 'agent_hired',
            actor_ids: [agent.id, c.id],
            importance: 5,
            payload: { role: 'worker', wage_cents: 1500, company: c.name },
          });
          return;
        }
      }
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
      // find any shop company with food in stock
      const shops = await db.execute<{ company_id: string; qty: number }>(sql`
        SELECT c.id AS company_id, i.qty AS qty
        FROM ${schema.company} c
        JOIN ${schema.inventory} i
          ON i.owner_kind = 'company' AND i.owner_id = c.id AND i.item_id = 1
        WHERE c.industry IN ('shop','farm') AND i.qty > 0
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
        importance: 2,
        payload: { item: 'food', qty, amount_cents: total },
      });
      return;
    }
    case 'steal': {
      const targetId = action.target_agent_id;
      const [target] = await db.select().from(schema.agent).where(eq(schema.agent.id, targetId)).limit(1);
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
      const [inc] = await db
        .insert(schema.incident)
        .values({
          kind: 'theft',
          perp_id: agent.id,
          victim_id: targetId,
          severity: 2,
          resolved: false,
        })
        .returning({ id: schema.incident.id });
      await writeEvent({
        kind: 'incident_theft',
        actor_ids: [agent.id, targetId],
        importance: 7,
        payload: { amount_cents: loot, incident_id: inc!.id },
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
    default:
      // unimplemented v1 actions degrade to idle
      await db.update(schema.agent).set({ state: 'idle' }).where(eq(schema.agent.id, agent.id));
      return;
  }
}
