import type { FastifyInstance } from 'fastify';
import { db, schema } from '@thecolony/db';
import { eq, desc, sql, or } from 'drizzle-orm';

export async function registerAgentRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/v1/agent/:id', async (req, reply) => {
    const id = req.params.id;
    const rows = await db.select().from(schema.agent).where(eq(schema.agent.id, id)).limit(1);
    const agent = rows[0];
    if (!agent) return reply.code(404).send({ error: 'not found' });

    const recentEvents = await db
      .select()
      .from(schema.world_event)
      .where(sql`${schema.world_event.actor_ids} @> ARRAY[${id}::uuid]`)
      .orderBy(desc(schema.world_event.t))
      .limit(20);

    const memories = await db
      .select({
        id: schema.agent_memory.id,
        t: schema.agent_memory.t,
        kind: schema.agent_memory.kind,
        summary: schema.agent_memory.summary,
        salience: schema.agent_memory.salience,
      })
      .from(schema.agent_memory)
      .where(eq(schema.agent_memory.agent_id, id))
      .orderBy(desc(schema.agent_memory.t))
      .limit(10);

    const rels = await db
      .select()
      .from(schema.agent_relationship)
      .where(eq(schema.agent_relationship.subj_id, id))
      .limit(20);

    return { agent, recentEvents, memories, relationships: rels };
  });

  app.get('/v1/agents', async () => {
    const rows = await db
      .select({
        id: schema.agent.id,
        name: schema.agent.name,
        balance_cents: schema.agent.balance_cents,
        occupation: schema.agent.occupation,
        status: schema.agent.status,
        portrait_seed: schema.agent.portrait_seed,
      })
      .from(schema.agent)
      .orderBy(desc(schema.agent.balance_cents))
      .limit(100);
    return { agents: rows };
  });
}
