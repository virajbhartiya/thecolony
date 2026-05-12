import { db, schema } from '@thecolony/db';
import { sql, eq } from 'drizzle-orm';
import { writeEvent } from './event-writer';

// needs decay runs every NEEDS_DECAY_EVERY_TICKS = 6 seconds.
// Target: hunger 0 -> 100 in ~25 real minutes of NOT eating
// (≈ 1 sim-day at 1× speed). 100 / (25 * 60 / 6) = 100 / 250 = 0.4.
const HUNGER_PER_TICK = 0.4;
const ENERGY_DROP_AWAKE = 0.18;
const ENERGY_GAIN_SLEEP = 1.2;

export async function decayNeedsAll(): Promise<void> {
  await db.execute(sql`
    UPDATE ${schema.agent}
    SET needs = jsonb_set(
        jsonb_set(
          needs,
          '{hunger}',
          to_jsonb(LEAST(100, GREATEST(0, (needs->>'hunger')::float + ${HUNGER_PER_TICK})))
        ),
        '{energy}',
        to_jsonb(LEAST(100, GREATEST(0,
          CASE
            WHEN state = 'sleeping' THEN (needs->>'energy')::float + ${ENERGY_GAIN_SLEEP}
            ELSE (needs->>'energy')::float - ${ENERGY_DROP_AWAKE}
          END
        )))
      )
    WHERE status = 'alive'
  `);
}

export async function sweepDeaths(): Promise<void> {
  // Death is rare-but-real: requires sustained starvation (hunger pinned at 100),
  // with a small probability per sweep so the city doesn't depopulate in waves.
  const starving = await db.execute<{ id: string; name: string }>(
    sql`SELECT id, name FROM ${schema.agent}
        WHERE status = 'alive'
          AND (needs->>'hunger')::float >= 100
          AND random() < 0.015
        LIMIT 1`,
  );
  for (const row of starving) {
    await db
      .update(schema.agent)
      .set({ status: 'dead', state: 'dead', died_at: new Date() })
      .where(eq(schema.agent.id, row.id));
    await db.insert(schema.death_event).values({ agent_id: row.id, cause: 'starvation' });
    await writeEvent({
      kind: 'agent_died',
      actor_ids: [row.id],
      importance: 8,
      payload: { cause: 'starvation', name: row.name },
    });
  }
}
