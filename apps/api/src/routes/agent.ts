import type { FastifyInstance } from 'fastify';
import { db, schema } from '@thecolony/db';
import { eq, desc, sql } from 'drizzle-orm';

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

    const employer = agent.employer_id
      ? (
          await db
            .select({
              id: schema.company.id,
              name: schema.company.name,
              industry: schema.company.industry,
              treasury_cents: schema.company.treasury_cents,
            })
            .from(schema.company)
            .where(eq(schema.company.id, agent.employer_id))
            .limit(1)
        )[0] ?? null
      : null;

    const home = agent.home_id
      ? (
          await db
            .select({
              id: schema.building.id,
              name: schema.building.name,
              kind: schema.building.kind,
              rent_cents: schema.building.rent_cents,
            })
            .from(schema.building)
            .where(eq(schema.building.id, agent.home_id))
            .limit(1)
        )[0] ?? null
      : null;

    const inventory = await db.execute<{ key: string; qty: number }>(sql`
      SELECT it.key, i.qty
      FROM ${schema.inventory} i
      JOIN ${schema.item_type} it ON it.id = i.item_id
      WHERE i.owner_kind = 'agent' AND i.owner_id = ${id}
      ORDER BY it.key ASC
    `);

    const votes = await db
      .select({
        election_id: schema.city_vote.election_id,
        candidate_id: schema.city_vote.candidate_id,
        reason: schema.city_vote.reason,
        t: schema.city_vote.t,
      })
      .from(schema.city_vote)
      .where(eq(schema.city_vote.voter_id, id))
      .orderBy(desc(schema.city_vote.t))
      .limit(5);

    return { agent, employer, home, inventory, votes, recentEvents, memories, relationships: rels };
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
