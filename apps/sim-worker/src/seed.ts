import { db, schema } from '@thecolony/db';
import { sql } from 'drizzle-orm';
import { env } from '@thecolony/config';
import { generateWorld, genName, genTraits, genStarterNeeds, mulberry32 } from '@thecolony/sim';
import { log } from './log';

async function main() {
  log.info('seeding world');
  const world = generateWorld(42);

  await db.execute(sql`TRUNCATE TABLE
    ${schema.world_event},
    ${schema.death_event},
    ${schema.birth_event},
    ${schema.market_order},
    ${schema.message},
    ${schema.conversation},
    ${schema.group_membership},
    ${schema.ideology_group},
    ${schema.incident},
    ${schema.agent_memory},
    ${schema.agent_relationship},
    ${schema.ledger_entry},
    ${schema.inventory},
    ${schema.job},
    ${schema.company},
    ${schema.agent},
    ${schema.building},
    ${schema.item_type}
    RESTART IDENTITY CASCADE`);

  // item types
  await db.insert(schema.item_type).values([
    { id: 1, key: 'food', base_value_cents: 200, perishable: true },
    { id: 2, key: 'water', base_value_cents: 50, perishable: true },
    { id: 3, key: 'energy', base_value_cents: 100, perishable: false },
    { id: 4, key: 'cloth', base_value_cents: 400, perishable: false },
    { id: 5, key: 'tool', base_value_cents: 1200, perishable: false },
    { id: 6, key: 'luxury', base_value_cents: 3000, perishable: false },
  ]);

  // buildings
  const buildingRows = await db
    .insert(schema.building)
    .values(
      world.buildings.map((b) => ({
        kind: b.kind,
        zone_kind: b.zone_kind,
        name: b.name,
        tile_x: b.tile_x,
        tile_y: b.tile_y,
        tile_w: b.tile_w,
        tile_h: b.tile_h,
        capacity: b.capacity,
        rent_cents: b.rent_cents,
        sprite_key: b.sprite_key,
        owner_kind: 'city' as const,
      })),
    )
    .returning({ id: schema.building.id, kind: schema.building.kind, tile_x: schema.building.tile_x, tile_y: schema.building.tile_y });
  log.info({ count: buildingRows.length }, 'inserted buildings');

  // companies — one per producing building
  const producingKinds = new Set(['farm', 'factory', 'water_works', 'power_plant', 'shop', 'bar']);
  const producing = buildingRows.filter((b) => producingKinds.has(b.kind));
  const companyRows = [];
  for (const b of producing) {
    const [c] = await db
      .insert(schema.company)
      .values({
        name: `${b.kind}-${b.id.slice(0, 6)}`,
        founder_id: null,
        charter: { industry: b.kind, mission: `${b.kind} on tile ${b.tile_x},${b.tile_y}` },
        treasury_cents: 100000,
        building_id: b.id,
        industry: b.kind,
      })
      .returning({ id: schema.company.id });
    companyRows.push(c!);
  }
  log.info({ count: companyRows.length }, 'inserted companies');

  // agents
  const rng = mulberry32(1234);
  const count = env().SIM_AGENT_COUNT;
  const homeCandidates = buildingRows.filter((b) => b.kind === 'house' || b.kind === 'apartment');
  for (let i = 0; i < count; i++) {
    const home = homeCandidates[Math.floor(rng() * homeCandidates.length)];
    const pos = home ? { x: home.tile_x + 0.5, y: home.tile_y + 0.5 } : { x: 30, y: 30 };
    await db.insert(schema.agent).values({
      name: genName(rng),
      born_at: new Date(Date.now() - (18 + Math.floor(rng() * 50)) * 365 * 86400_000),
      age_years: 18 + Math.floor(rng() * 50),
      traits: genTraits(rng),
      needs: genStarterNeeds(),
      occupation: null,
      employer_id: null,
      home_id: home?.id ?? null,
      balance_cents: 5000 + Math.floor(rng() * 5000),
      status: 'alive',
      portrait_seed: `seed-${i}-${Math.floor(rng() * 1e9)}`,
      pos_x: pos.x,
      pos_y: pos.y,
      target_x: pos.x,
      target_y: pos.y,
      state: 'idle',
    });
  }
  log.info({ count }, 'inserted agents');

  log.info('seed complete');
}

main()
  .catch((e) => {
    log.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
