import { db, schema } from '@thecolony/db';
import type { WorldEventKind } from '@thecolony/domain';
import { publish } from './publisher';

export interface WriteEventArgs {
  kind: WorldEventKind;
  actor_ids: string[];
  location_id?: string | null;
  importance?: number;
  payload?: Record<string, unknown>;
}

export async function writeEvent(args: WriteEventArgs): Promise<number> {
  const [row] = await db
    .insert(schema.world_event)
    .values({
      kind: args.kind,
      actor_ids: args.actor_ids,
      location_id: args.location_id ?? null,
      importance: args.importance ?? 3,
      payload: args.payload ?? {},
    })
    .returning({ id: schema.world_event.id, t: schema.world_event.t });

  const id = Number(row!.id);
  void publish({
    id,
    t: row!.t,
    kind: args.kind,
    actor_ids: args.actor_ids,
    location_id: args.location_id ?? null,
    importance: args.importance ?? 3,
    payload: args.payload ?? {},
  });
  return id;
}
