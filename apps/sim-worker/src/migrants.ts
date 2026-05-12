import { db, schema } from '@thecolony/db';
import { sql, eq } from 'drizzle-orm';
import { applyProfessionBias, genName, genTraits, genStarterNeeds, mulberry32, pickProfession } from '@thecolony/sim';
import { writeEvent } from './event-writer';

const POP_FLOOR = 25;
const SPAWN_PER_DAY = 2;

export async function spawnMigrantsIfNeeded(): Promise<void> {
  const [{ n: alive } = { n: 0 }] = await db.execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n FROM ${schema.agent} WHERE status = 'alive'`,
  );
  if (Number(alive) >= POP_FLOOR) return;

  const homeCandidates = await db
    .select({ id: schema.building.id, tile_x: schema.building.tile_x, tile_y: schema.building.tile_y })
    .from(schema.building)
    .where(sql`kind IN ('house','apartment')`);

  const rng = mulberry32(Date.now() & 0xffffffff);
  for (let i = 0; i < SPAWN_PER_DAY; i++) {
    const home = homeCandidates[Math.floor(rng() * homeCandidates.length)];
    const pos = home ? { x: home.tile_x + 0.5, y: home.tile_y + 0.5 } : { x: 30, y: 30 };
    const ageYears = 18 + Math.floor(rng() * 50);
    const profile = pickProfession(i + Math.floor(rng() * 100), rng);
    const [created] = await db
      .insert(schema.agent)
      .values({
        name: genName(rng),
        born_at: new Date(Date.now() - ageYears * 365 * 86400_000),
        age_years: ageYears,
        traits: applyProfessionBias(genTraits(rng), profile),
        needs: genStarterNeeds(),
        occupation: profile.title,
        balance_cents: 8000 + Math.floor(rng() * 4000),
        status: 'alive',
        portrait_seed: `m-${Date.now()}-${i}-${Math.floor(rng() * 1e9)}`,
        pos_x: pos.x,
        pos_y: pos.y,
        target_x: pos.x,
        target_y: pos.y,
        home_id: home?.id ?? null,
        state: 'idle',
      })
      .returning({ id: schema.agent.id, name: schema.agent.name });

    // starter food + water
    await db.insert(schema.inventory).values([
      { owner_kind: 'agent', owner_id: created!.id, item_id: 1, qty: 20 },
      { owner_kind: 'agent', owner_id: created!.id, item_id: 2, qty: 10 },
    ]);
    await db.insert(schema.birth_event).values({
      agent_id: created!.id,
      parent_ids: [],
      kind: 'migrant',
    });
    await db.insert(schema.agent_memory).values({
      agent_id: created!.id,
      kind: 'belief',
      summary: `${created!.name} arrived as a ${profile.title.toLowerCase()} looking for ${profile.skill_tags.join(', ')} work.`,
      salience: 0.8,
      source_event_ids: [],
    });
    await writeEvent({
      kind: 'migrant_arrived',
      actor_ids: [created!.id],
      importance: 6,
      payload: { name: created!.name, age: ageYears, occupation: profile.title },
    });
  }
}
