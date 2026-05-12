/**
 * Agent-initiated construction.
 *
 * Buildings under construction are stored with condition < 100. The daily
 * progress job ticks condition up by ~20 per sim-day. When condition >= 100,
 * the building goes operational (and any company tied to it is activated).
 */
import { db, schema } from '@thecolony/db';
import { eq, sql } from 'drizzle-orm';
import type { BuildingKind } from '@thecolony/domain';
import { writeEvent } from './event-writer';

const COST_BY_KIND: Record<string, number> = {
  shop: 8_000,
  bar: 9_000,
  cafe: 7_000,
  factory: 18_000,
  farm: 10_000,
  house: 6_000,
  apartment: 14_000,
};

const SIZE_BY_KIND: Record<string, { w: number; h: number; capacity: number; rent: number }> = {
  shop: { w: 2, h: 2, capacity: 6, rent: 0 },
  bar: { w: 3, h: 2, capacity: 12, rent: 0 },
  cafe: { w: 2, h: 2, capacity: 6, rent: 0 },
  factory: { w: 4, h: 3, capacity: 10, rent: 0 },
  farm: { w: 4, h: 3, capacity: 6, rent: 0 },
  house: { w: 2, h: 2, capacity: 4, rent: 1500 },
  apartment: { w: 3, h: 4, capacity: 12, rent: 1200 },
};

const ZONE_BY_KIND: Record<string, string> = {
  shop: 'commercial',
  bar: 'commercial',
  cafe: 'commercial',
  factory: 'industrial',
  farm: 'industrial',
  house: 'residential',
  apartment: 'residential',
};

/** Try to find an unoccupied area on the city grid near the proposer. */
async function findEmptyPlot(
  near: { x: number; y: number },
  w: number,
  h: number,
): Promise<{ tile_x: number; tile_y: number } | null> {
  const buildings = await db
    .select({
      tile_x: schema.building.tile_x,
      tile_y: schema.building.tile_y,
      tile_w: schema.building.tile_w,
      tile_h: schema.building.tile_h,
    })
    .from(schema.building);

  const occupied = new Set<string>();
  for (const b of buildings) {
    for (let dy = -1; dy <= b.tile_h; dy++) {
      for (let dx = -1; dx <= b.tile_w; dx++) {
        occupied.add(`${b.tile_x + dx},${b.tile_y + dy}`);
      }
    }
  }

  // spiral out from near
  for (let r = 3; r <= 14; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(near.x) + dx;
        const ty = Math.round(near.y) + dy;
        if (tx < 4 || ty < 4 || tx > 88 || ty > 88) continue;
        let ok = true;
        for (let oy = 0; oy < h + 1 && ok; oy++) {
          for (let ox = 0; ox < w + 1 && ok; ox++) {
            if (occupied.has(`${tx + ox},${ty + oy}`)) ok = false;
          }
        }
        if (ok) return { tile_x: tx, tile_y: ty };
      }
    }
  }
  return null;
}

export async function proposeBuilding(
  agent: { id: string; balance_cents: number; pos_x: number; pos_y: number; name: string },
  buildingKind: BuildingKind,
  capitalCents: number,
): Promise<{ ok: boolean; reason?: string }> {
  const baseCost = COST_BY_KIND[buildingKind];
  if (baseCost == null) return { ok: false, reason: 'invalid kind' };
  const cost = Math.max(baseCost, capitalCents);
  if (agent.balance_cents < cost) return { ok: false, reason: 'insufficient capital' };
  const size = SIZE_BY_KIND[buildingKind]!;
  const plot = await findEmptyPlot({ x: agent.pos_x, y: agent.pos_y }, size.w, size.h);
  if (!plot) return { ok: false, reason: 'no plot' };

  const name = `${agent.name.split(' ')[0]} ${buildingKind.charAt(0).toUpperCase() + buildingKind.slice(1)}`;
  const [building] = await db
    .insert(schema.building)
    .values({
      kind: buildingKind,
      zone_kind: ZONE_BY_KIND[buildingKind] ?? 'commercial',
      name,
      tile_x: plot.tile_x,
      tile_y: plot.tile_y,
      tile_w: size.w,
      tile_h: size.h,
      capacity: size.capacity,
      rent_cents: size.rent,
      sprite_key: buildingKind,
      condition: 5, // under construction; will rise daily
      owner_kind: 'agent',
      owner_id: agent.id,
    })
    .returning({ id: schema.building.id });

  // deduct cost
  await db
    .update(schema.agent)
    .set({ balance_cents: sql`${schema.agent.balance_cents} - ${cost}` })
    .where(eq(schema.agent.id, agent.id));
  await db.insert(schema.ledger_entry).values({
    debit_kind: 'agent',
    debit_id: agent.id,
    credit_kind: 'building',
    credit_id: building!.id,
    amount_cents: cost,
    reason: 'construction',
  });

  await writeEvent({
    kind: 'building_proposed',
    actor_ids: [agent.id],
    location_id: building!.id,
    importance: 7,
    payload: {
      building_id: building!.id,
      building_kind: buildingKind,
      name,
      cost_cents: cost,
      tile_x: plot.tile_x,
      tile_y: plot.tile_y,
    },
  });
  return { ok: true };
}

/**
 * Daily progress: advance condition of any under-construction building.
 * When condition crosses 100, the building "opens" and a company is created
 * for productive kinds (shop/bar/cafe/factory/farm).
 */
export async function advanceConstruction(): Promise<void> {
  const advancing = await db.execute<{
    id: string;
    kind: string;
    name: string;
    condition: number;
    owner_id: string | null;
  }>(sql`
    UPDATE ${schema.building}
    SET condition = LEAST(100, condition + 25)
    WHERE condition < 100
    RETURNING id, kind, name, condition, owner_id
  `);
  for (const b of advancing) {
    if (b.condition >= 100) {
      // open the building, create a company for productive kinds
      if (['shop', 'bar', 'cafe', 'factory', 'farm'].includes(b.kind)) {
        const ownerName = b.owner_id
          ? (
              await db
                .select({ name: schema.agent.name })
                .from(schema.agent)
                .where(eq(schema.agent.id, b.owner_id))
                .limit(1)
            )[0]?.name ?? 'a citizen'
          : 'the city';
        await db.insert(schema.company).values({
          name: b.name,
          founder_id: b.owner_id,
          charter: { industry: b.kind, mission: `${b.kind} founded by ${ownerName}` },
          treasury_cents: 5_000,
          building_id: b.id,
          industry: b.kind,
        });
      }
      await writeEvent({
        kind: 'building_opened',
        actor_ids: b.owner_id ? [b.owner_id] : [],
        location_id: b.id,
        importance: 6,
        payload: { building_id: b.id, building_kind: b.kind, name: b.name },
      });
    }
  }
}
