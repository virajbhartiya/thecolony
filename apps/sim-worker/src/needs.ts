import { db, schema } from '@thecolony/db';
import { sql, eq } from 'drizzle-orm';
import { writeEvent } from './event-writer';

const HUNGER_PER_TICK = 0.6;
const ENERGY_DROP_AWAKE = 0.3;
const ENERGY_GAIN_SLEEP = 1.5;

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
  const starving = await db.execute<{ id: string; name: string }>(
    sql`SELECT id, name FROM ${schema.agent}
        WHERE status = 'alive' AND (needs->>'hunger')::float >= 100
        ORDER BY updated_at ASC LIMIT 5`,
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
