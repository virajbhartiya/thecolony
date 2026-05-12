import { db, schema } from '@thecolony/db';
import { sql, and, eq, ne } from 'drizzle-orm';

const SPEED_TILES_PER_SEC = 0.6;

export async function stepMovement(dtMs: number): Promise<number> {
  const dtSec = dtMs / 1000;
  const moveDelta = SPEED_TILES_PER_SEC * dtSec;
  const result = await db.execute<{ id: string }>(sql`
    UPDATE ${schema.agent}
    SET
      pos_x = CASE
        WHEN ABS(target_x - pos_x) <= ${moveDelta} THEN target_x
        WHEN target_x > pos_x THEN pos_x + ${moveDelta}
        ELSE pos_x - ${moveDelta}
      END,
      pos_y = CASE
        WHEN ABS(target_y - pos_y) <= ${moveDelta} THEN target_y
        WHEN target_y > pos_y THEN pos_y + ${moveDelta}
        ELSE pos_y - ${moveDelta}
      END,
      state = CASE
        WHEN ABS(target_x - pos_x) <= ${moveDelta} AND ABS(target_y - pos_y) <= ${moveDelta}
          THEN 'idle'
        ELSE 'walking'
      END
    WHERE status = 'alive' AND state IN ('walking', 'idle') AND (pos_x <> target_x OR pos_y <> target_y)
    RETURNING id
  `);
  return result.length;
}
