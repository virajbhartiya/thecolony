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
        condition: schema.building.condition,
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

    const gdpRow = await db.execute<{ gdp: number | null }>(sql`
      SELECT (
        (SELECT COALESCE(SUM(balance_cents)::bigint, 0)::bigint FROM ${schema.agent} WHERE status <> 'dead') +
        (SELECT COALESCE(SUM(treasury_cents)::bigint, 0)::bigint FROM ${schema.company} WHERE dissolved_at IS NULL)
      )::bigint AS gdp
    `);
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
    return { seed: 42, width: MAP_WIDTH, height: MAP_HEIGHT };
  });

  // True 24h windowed metrics — backs the TopBar so values reflect the
  // actual database, not whatever happens to be in the client's events buffer.
  let metricsCache: { t: number; data: unknown } | null = null;
  const METRICS_CACHE_MS = 5_000;
  app.get('/v1/world/metrics', async () => {
    const now = Date.now();
    if (metricsCache && now - metricsCache.t < METRICS_CACHE_MS) return metricsCache.data;

    const [counts] = await db.execute<{
      total_events: number;
      crime_24h: number;
      deaths_24h: number;
      births_24h: number;
      hires_24h: number;
      fires_24h: number;
      evictions_24h: number;
      wages_24h_cents: number;
      rent_24h_cents: number;
      thefts_24h_amount_cents: number;
      trades_24h: number;
      orders_24h: number;
      group_founded_24h: number;
      company_founded_24h: number;
    }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM ${schema.world_event}) AS total_events,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours'
            AND kind IN ('incident_theft','incident_assault','incident_fraud','incident_breach')) AS crime_24h,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind = 'agent_died') AS deaths_24h,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind IN ('birth','migrant_arrived')) AS births_24h,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind = 'agent_hired') AS hires_24h,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind = 'agent_fired') AS fires_24h,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind = 'agent_evicted') AS evictions_24h,
        (SELECT COALESCE(SUM(amount_cents)::bigint, 0)::bigint FROM ${schema.ledger_entry}
          WHERE t > now() - interval '24 hours' AND reason = 'wage') AS wages_24h_cents,
        (SELECT COALESCE(SUM(amount_cents)::bigint, 0)::bigint FROM ${schema.ledger_entry}
          WHERE t > now() - interval '24 hours' AND reason = 'rent') AS rent_24h_cents,
        (SELECT COALESCE(SUM((payload->>'amount_cents')::bigint), 0)::bigint FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind = 'incident_theft') AS thefts_24h_amount_cents,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind = 'trade_executed') AS trades_24h,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind = 'order_placed') AS orders_24h,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind = 'group_founded') AS group_founded_24h,
        (SELECT COUNT(*)::int FROM ${schema.world_event}
          WHERE t > now() - interval '24 hours' AND kind = 'company_founded') AS company_founded_24h
    `);

    const [outstanding] = await db.execute<{ warrants_outstanding: number; jailed_now: number; bankrupt_now: number }>(sql`
      SELECT
        (SELECT COALESCE(SUM(warrants)::int, 0)::int FROM ${schema.legal_status}) AS warrants_outstanding,
        (SELECT COUNT(*)::int FROM ${schema.agent} WHERE status = 'jailed') AS jailed_now,
        (SELECT COUNT(*)::int FROM ${schema.agent} WHERE status = 'bankrupt') AS bankrupt_now
    `);

    const [satisfaction] = await db.execute<{ avg_life_satisfaction: number }>(sql`
      SELECT COALESCE(AVG((needs->>'life_satisfaction')::float), 50)::int AS avg_life_satisfaction
      FROM ${schema.agent} WHERE status = 'alive'
    `);

    const mood_index = Math.round((Number(satisfaction?.avg_life_satisfaction ?? 50) - 50));

    const data = {
      ...counts,
      ...outstanding,
      mood_index,
      avg_life_satisfaction: Number(satisfaction?.avg_life_satisfaction ?? 50),
    };
    metricsCache = { t: now, data };
    return data;
  });
}
