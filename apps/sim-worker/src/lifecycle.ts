import { db, schema } from '@thecolony/db';
import { eq, sql } from 'drizzle-orm';
import { synthesizeEulogy } from '@thecolony/llm';
import type { Traits } from '@thecolony/domain';
import { genName, genStarterNeeds, mulberry32 } from '@thecolony/sim';
import { writeEvent } from './event-writer';

export async function markAgentDead(agentId: string, cause: string): Promise<boolean> {
  const [agent] = await db.select().from(schema.agent).where(eq(schema.agent.id, agentId)).limit(1);
  if (!agent || agent.status === 'dead') return false;

  const memories = await db.execute<{ summary: string }>(sql`
    SELECT summary
    FROM ${schema.agent_memory}
    WHERE agent_id = ${agentId}
    ORDER BY salience DESC, t DESC
    LIMIT 6
  `);
  const events = await db.execute<{ kind: string }>(sql`
    SELECT kind
    FROM ${schema.world_event}
    WHERE actor_ids @> ARRAY[${agentId}::uuid]
    ORDER BY importance DESC, t DESC
    LIMIT 12
  `);
  const eulogy = await synthesizeEulogy({
    name: agent.name,
    occupation: agent.occupation,
    cause,
    memories: memories.map((memory) => memory.summary),
    events: events.map((event) => event.kind),
  });

  await db
    .update(schema.agent)
    .set({ status: 'dead', state: 'dead', died_at: new Date(), updated_at: new Date() })
    .where(eq(schema.agent.id, agentId));
  await db
    .insert(schema.death_event)
    .values({ agent_id: agentId, cause, eulogy })
    .onConflictDoNothing();
  await writeEvent({
    kind: 'agent_died',
    actor_ids: [agentId],
    importance: 9,
    payload: { cause, name: agent.name, occupation: agent.occupation, eulogy },
  });
  return true;
}

export async function sweepLifecycle(): Promise<{ old_age: number; suicide: number; bankrupt: number }> {
  const oldAge = await db.execute<{ id: string }>(sql`
    SELECT id
    FROM ${schema.agent}
    WHERE status = 'alive'
      AND age_years >= 66
      AND random() < LEAST(0.018, (age_years - 65) * 0.002)
    LIMIT 2
  `);
  let oldAgeDeaths = 0;
  for (const row of oldAge) {
    if (await markAgentDead(row.id, 'old_age')) oldAgeDeaths++;
  }

  const suicide = await db.execute<{ id: string }>(sql`
    SELECT id
    FROM ${schema.agent}
    WHERE status = 'alive'
      AND (needs->>'life_satisfaction')::float < 5
      AND random() < 0.01
    LIMIT 1
  `);
  let suicideDeaths = 0;
  for (const row of suicide) {
    if (await markAgentDead(row.id, 'suicide')) suicideDeaths++;
  }

  const bankrupt = await db.execute<{ id: string; name: string }>(sql`
    SELECT a.id, a.name
    FROM ${schema.agent} a
    LEFT JOIN ${schema.legal_status} l ON l.agent_id = a.id
    WHERE a.status = 'alive'
      AND (a.balance_cents <= -2000 OR COALESCE(l.debts_cents, 0) > 12000)
    LIMIT 3
  `);
  for (const row of bankrupt) {
    await db
      .update(schema.agent)
      .set({ status: 'bankrupt', state: 'idle', updated_at: new Date() })
      .where(eq(schema.agent.id, row.id));
    await writeEvent({
      kind: 'agent_bankrupt',
      actor_ids: [row.id],
      importance: 7,
      payload: { name: row.name },
    });
  }

  return { old_age: oldAgeDeaths, suicide: suicideDeaths, bankrupt: bankrupt.length };
}

export async function applyConceptions(limit = 1, force = false): Promise<number> {
  const pairs = await db.execute<{
    parent_a: string;
    parent_b: string;
    home_id: string;
    tile_x: number;
    tile_y: number;
    traits_a: Traits;
    traits_b: Traits;
    affinity: number;
  }>(sql`
    SELECT a.id AS parent_a, b.id AS parent_b, a.home_id,
      h.tile_x, h.tile_y,
      a.traits AS traits_a, b.traits AS traits_b,
      COALESCE((rab.affinity + rba.affinity) / 2.0, rab.affinity, rba.affinity, 0)::float AS affinity
    FROM ${schema.agent} a
    JOIN ${schema.agent} b ON a.home_id = b.home_id AND a.id < b.id
    JOIN ${schema.building} h ON h.id = a.home_id
    LEFT JOIN ${schema.agent_relationship} rab ON rab.subj_id = a.id AND rab.obj_id = b.id
    LEFT JOIN ${schema.agent_relationship} rba ON rba.subj_id = b.id AND rba.obj_id = a.id
    WHERE a.status = 'alive'
      AND b.status = 'alive'
      AND a.home_id IS NOT NULL
      AND a.age_years BETWEEN 18 AND 45
      AND b.age_years BETWEEN 18 AND 45
      AND COALESCE((rab.affinity + rba.affinity) / 2.0, rab.affinity, rba.affinity, 0) > 60
      AND (${force} OR random() < 0.08)
    ORDER BY random()
    LIMIT ${limit}
  `);

  let created = 0;
  for (const pair of pairs) {
    const rng = mulberry32(Date.now() ^ created);
    const traits = blendTraits(pair.traits_a, pair.traits_b, rng);
    const name = genName(rng);
    const [child] = await db
      .insert(schema.agent)
      .values({
        name,
        born_at: new Date(Date.now() - 18 * 365 * 86400_000),
        age_years: 18,
        traits,
        needs: genStarterNeeds(),
        occupation: 'Apprentice',
        employer_id: null,
        home_id: pair.home_id,
        balance_cents: 2500 + Math.floor(rng() * 1500),
        status: 'alive',
        portrait_seed: `child-${Date.now()}-${created}-${Math.floor(rng() * 1e9)}`,
        pos_x: Number(pair.tile_x) + 0.5,
        pos_y: Number(pair.tile_y) + 0.5,
        target_x: Number(pair.tile_x) + 0.5,
        target_y: Number(pair.tile_y) + 0.5,
        state: 'idle',
      })
      .returning({ id: schema.agent.id, name: schema.agent.name });
    if (!child) continue;

    await db.insert(schema.birth_event).values({
      agent_id: child.id,
      parent_ids: [pair.parent_a, pair.parent_b],
      kind: 'conception',
    });
    await db.insert(schema.inventory).values([
      { owner_kind: 'agent', owner_id: child.id, item_id: 1, qty: 8 },
      { owner_kind: 'agent', owner_id: child.id, item_id: 2, qty: 4 },
    ]);
    await db.insert(schema.agent_memory).values({
      agent_id: child.id,
      kind: 'belief',
      summary: `${child.name} entered civic life carrying traits from two parents in the same home.`,
      salience: 0.82,
      source_event_ids: [],
    });
    await writeEvent({
      kind: 'birth',
      actor_ids: [child.id, pair.parent_a, pair.parent_b],
      importance: 8,
      payload: { name: child.name, kind: 'conception', parent_ids: [pair.parent_a, pair.parent_b] },
    });
    created++;
  }
  return created;
}

function blendTraits(a: Traits, b: Traits, rng: () => number): Traits {
  const out = {} as Traits;
  for (const key of Object.keys(a) as Array<keyof Traits>) {
    const noise = (rng() - 0.5) * 0.16;
    const value = key === 'ideology_lean'
      ? ((a[key] + b[key]) / 2) + noise * 2
      : ((a[key] + b[key]) / 2) + noise;
    out[key] = Math.max(key === 'ideology_lean' ? -1 : 0, Math.min(1, value));
  }
  return out;
}
