import type { FastifyInstance } from 'fastify';
import { db, schema } from '@thecolony/db';
import { eq, sql } from 'drizzle-orm';
import { MAP_HEIGHT, MAP_WIDTH } from '@thecolony/domain';

let snapshotCache: { t: number; data: unknown } | null = null;
const CACHE_MS = 1000;

export async function registerWorldRoutes(app: FastifyInstance) {
  app.get('/v1/world/snapshot', async () => {
    const now = Date.now();
    if (snapshotCache && now - snapshotCache.t < CACHE_MS) return snapshotCache.data;

    const buildings = await db
      .select({
        id: schema.building.id,
        kind: schema.building.kind,
        zone_kind: schema.building.zone_kind,
        name: schema.building.name,
        tile_x: schema.building.tile_x,
        tile_y: schema.building.tile_y,
        tile_w: schema.building.tile_w,
        tile_h: schema.building.tile_h,
        capacity: schema.building.capacity,
        rent_cents: schema.building.rent_cents,
        sprite_key: schema.building.sprite_key,
      })
      .from(schema.building);

    const agents = await db
      .select({
        id: schema.agent.id,
        name: schema.agent.name,
        pos_x: schema.agent.pos_x,
        pos_y: schema.agent.pos_y,
        target_x: schema.agent.target_x,
        target_y: schema.agent.target_y,
        state: schema.agent.state,
        status: schema.agent.status,
        portrait_seed: schema.agent.portrait_seed,
      })
      .from(schema.agent)
      .where(sql`status <> 'dead'`);

    const gdpRow = await db.execute<{ gdp: number | null }>(
      sql`SELECT COALESCE(SUM(balance_cents)::bigint, 0)::bigint AS gdp FROM ${schema.agent} WHERE status <> 'dead'`,
    );
    const gdp_cents = Number(gdpRow[0]?.gdp ?? 0);

    const data = {
      t: new Date().toISOString(),
      sim_time: new Date().toISOString(),
      speed: 1,
      population: agents.length,
      gdp_cents,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      buildings,
      agents,
    };
    snapshotCache = { t: now, data };
    return data;
  });

  app.get('/v1/world/terrain', async () => {
    // Terrain is deterministic from seed — re-derive on the client for free.
    // We expose only metadata here for now; renderer regenerates terrain locally.
    return { seed: 42, width: MAP_WIDTH, height: MAP_HEIGHT };
  });
}
