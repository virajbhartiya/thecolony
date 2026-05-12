import type { FastifyInstance } from 'fastify';
import { db, schema } from '@thecolony/db';
import { desc } from 'drizzle-orm';

export async function registerEventRoutes(app: FastifyInstance) {
  app.get('/v1/events', async () => {
    const events = await db
      .select()
      .from(schema.world_event)
      .orderBy(desc(schema.world_event.t))
      .limit(100);
    return { events };
  });
}
