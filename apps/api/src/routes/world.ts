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
        occupation: schema.agent.occupation,
        balance_cents: schema.agent.balance_cents,
        portrait_seed: schema.agent.portrait_seed,
      })
      .from(schema.agent)
      .where(sql`status <> 'dead'`);

    const gdpRow = await db.execute<{ gdp: number | null }>(
      sql`SELECT COALESCE(SUM(balance_cents)::bigint, 0)::bigint AS gdp FROM ${schema.agent} WHERE status <> 'dead'`,
    );
    const gdp_cents = Number(gdpRow[0]?.gdp ?? 0);
    const governmentRows = await db
      .select({ value: schema.city_state.value })
      .from(schema.city_state)
      .where(eq(schema.city_state.key, 'government'))
      .limit(1);
    const government = (governmentRows[0]?.value as {
      mayor_id?: string | null;
      mayor_name?: string | null;
      treasury_cents?: number;
      tax_rate_bps?: number;
      election_id?: string | null;
      next_election_at?: string | null;
      turnout?: number | null;
    } | undefined) ?? {
      mayor_id: null,
      mayor_name: null,
      treasury_cents: 0,
      tax_rate_bps: 0,
      election_id: null,
      next_election_at: null,
      turnout: null,
    };

    const data = {
      t: new Date().toISOString(),
      sim_time: new Date().toISOString(),
      speed: 1,
      population: agents.length,
      gdp_cents,
      government: {
        mayor_id: government.mayor_id ?? null,
        mayor_name: government.mayor_name ?? null,
        treasury_cents: Number(government.treasury_cents ?? 0),
        tax_rate_bps: Number(government.tax_rate_bps ?? 0),
        election_id: government.election_id ?? null,
        next_election_at: government.next_election_at ?? null,
        turnout: government.turnout ?? null,
      },
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
