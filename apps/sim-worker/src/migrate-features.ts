// One-shot, idempotent migration for the schools/police/supply-chain ship.
// Inserts new item_types (lumber/stone/steel) and new buildings (precinct,
// sawmill, quarry) with their seed companies. Safe to re-run.
import { db, schema } from '@thecolony/db';
import { sql } from 'drizzle-orm';
import { log } from './log';

async function main() {
  // 1. construction-material item types
  const newItems: Array<{ id: number; key: string; base_value_cents: number; perishable: boolean }> = [
    { id: 7, key: 'lumber', base_value_cents: 80, perishable: false },
    { id: 8, key: 'stone', base_value_cents: 60, perishable: false },
    { id: 9, key: 'steel', base_value_cents: 240, perishable: false },
  ];
  for (const it of newItems) {
    const r = await db.execute<{ id: number }>(sql`
      INSERT INTO ${schema.item_type} (id, key, base_value_cents, perishable)
      VALUES (${it.id}, ${it.key}, ${it.base_value_cents}, ${it.perishable})
      ON CONFLICT (key) DO NOTHING
      RETURNING id
    `);
    log.info({ key: it.key, inserted: r.length > 0 }, 'item_type');
  }

  // 2. new buildings + matching companies
  const newBuildings: Array<{
    kind: 'precinct' | 'sawmill' | 'quarry';
    name: string;
    tile_x: number;
    tile_y: number;
    tile_w: number;
    tile_h: number;
    capacity: number;
    sprite: string;
    zone: 'civic' | 'industrial';
    industry: string;
    company_name: string;
    mission: string;
  }> = [
    {
      kind: 'precinct', name: '1st Precinct', tile_x: 18, tile_y: 11, tile_w: 3, tile_h: 3,
      capacity: 8, sprite: 'civic', zone: 'civic', industry: 'precinct',
      company_name: 'Civic Patrol Bureau',
      mission: 'patrol the streets and bring the wanted to court',
    },
    {
      kind: 'sawmill', name: 'Riverside Sawmill', tile_x: 26, tile_y: 60, tile_w: 3, tile_h: 3,
      capacity: 6, sprite: 'factory', zone: 'industrial', industry: 'sawmill',
      company_name: 'Riverside Sawmill Co.',
      mission: 'mill lumber for builders raising houses, shops, and apartments',
    },
    {
      kind: 'quarry', name: 'Greystone Quarry', tile_x: 32, tile_y: 64, tile_w: 3, tile_h: 3,
      capacity: 6, sprite: 'factory', zone: 'industrial', industry: 'quarry',
      company_name: 'Greystone Quarry & Stone',
      mission: 'cut stone for foundations, factories, and city walls',
    },
  ];

  for (const b of newBuildings) {
    const existing = await db.execute<{ id: string }>(sql`
      SELECT id FROM ${schema.building} WHERE kind = ${b.kind} LIMIT 1
    `);
    if (existing[0]) {
      log.info({ kind: b.kind, building_id: existing[0].id }, 'building exists, skipping');
      continue;
    }
    const [row] = await db
      .insert(schema.building)
      .values({
        kind: b.kind,
        zone_kind: b.zone,
        name: b.name,
        tile_x: b.tile_x,
        tile_y: b.tile_y,
        tile_w: b.tile_w,
        tile_h: b.tile_h,
        capacity: b.capacity,
        rent_cents: 0,
        sprite_key: b.sprite,
        owner_kind: 'city',
        condition: 100,
      })
      .returning({ id: schema.building.id });
    log.info({ kind: b.kind, building_id: row!.id }, 'building inserted');

    await db.insert(schema.company).values({
      name: b.company_name,
      founder_id: null,
      charter: {
        industry: b.industry,
        district: b.zone === 'civic' ? 'Civic Quarter' : 'Old Mill',
        mission: b.mission,
        address: `${b.zone === 'civic' ? 'Civic Quarter' : 'Old Mill'} block ${b.tile_x},${b.tile_y}`,
        city_only: true,
      },
      treasury_cents: 100000,
      building_id: row!.id,
      industry: b.industry,
    });
    log.info({ company: b.company_name }, 'company inserted');
  }

  log.info('feature migration done');
}

main()
  .catch((e) => {
    log.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
