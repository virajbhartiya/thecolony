import { db, schema } from '@thecolony/db';
import { eq, sql } from 'drizzle-orm';
import { synthesizeDoctrine } from '@thecolony/llm';
import type { Agent } from '@thecolony/domain';
import { writeEvent } from './event-writer';

export interface GroupCandidate extends Record<string, unknown> {
  id: string;
  name: string;
  kind: string;
  doctrine: string;
  member_count: number;
  founder_ideology: number;
}

export interface GroupDecisionContext {
  current_group_id: string | null;
  current_group_name: string | null;
  current_group_kind: string | null;
  current_group_doctrine: string | null;
  candidate_groups: GroupCandidate[];
}

export async function loadGroupContext(agent: Agent): Promise<GroupDecisionContext> {
  const current = await db.execute<{
    id: string;
    name: string;
    kind: string;
    doctrine: string;
  }>(sql`
    SELECT g.id, g.name, g.kind, g.doctrine
    FROM ${schema.group_membership} m
    JOIN ${schema.ideology_group} g ON g.id = m.group_id
    WHERE m.agent_id = ${agent.id}
    ORDER BY m.joined_at ASC
    LIMIT 1
  `);

  const candidates = await db.execute<GroupCandidate>(sql`
    SELECT g.id, g.name, g.kind, g.doctrine,
      COUNT(m.agent_id)::int AS member_count,
      COALESCE((founder.traits->>'ideology_lean')::float, 0)::float AS founder_ideology
    FROM ${schema.ideology_group} g
    JOIN ${schema.agent} founder ON founder.id = g.founder_id
    LEFT JOIN ${schema.group_membership} m ON m.group_id = g.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM ${schema.group_membership} mine
      WHERE mine.group_id = g.id AND mine.agent_id = ${agent.id}
    )
    GROUP BY g.id, g.name, g.kind, g.doctrine, founder.traits
    ORDER BY COUNT(m.agent_id) DESC, g.founded_at DESC
    LIMIT 8
  `);

  const ranked = candidates
    .map((group) => ({
      ...group,
      member_count: Number(group.member_count),
      founder_ideology: Number(group.founder_ideology),
      fit: 1 - Math.min(2, Math.abs(agent.traits.ideology_lean - Number(group.founder_ideology))) / 2,
    }))
    .sort((a, b) => b.fit - a.fit || b.member_count - a.member_count)
    .slice(0, 4)
    .map(({ fit: _fit, ...group }) => group);

  const active = current[0] ?? null;
  return {
    current_group_id: active?.id ?? null,
    current_group_name: active?.name ?? null,
    current_group_kind: active?.kind ?? null,
    current_group_doctrine: active?.doctrine ?? null,
    candidate_groups: ranked,
  };
}

export async function foundGroup(
  agent: Agent,
  action: { name: string; kind_of: 'cult' | 'party' | 'union' | 'club'; doctrine?: string },
): Promise<void> {
  const existing = await db.select().from(schema.ideology_group).where(eq(schema.ideology_group.founder_id, agent.id)).limit(1);
  if (existing.length > 0) return;

  const doctrine = (action.doctrine?.trim() || (await synthesizeDoctrine({ agent, name: action.name, kind: action.kind_of }))).slice(0, 800);
  const [group] = await db
    .insert(schema.ideology_group)
    .values({
      name: action.name,
      kind: action.kind_of,
      founder_id: agent.id,
      doctrine,
    })
    .returning({ id: schema.ideology_group.id, name: schema.ideology_group.name });
  if (!group) return;

  await db
    .insert(schema.group_membership)
    .values({ agent_id: agent.id, group_id: group.id, role: 'founder' })
    .onConflictDoNothing();
  await db.insert(schema.agent_memory).values({
    agent_id: agent.id,
    kind: 'belief',
    summary: `${agent.name} founded ${group.name}: ${doctrine}`,
    salience: 0.88,
    source_event_ids: [],
  });
  await writeEvent({
    kind: 'group_founded',
    actor_ids: [agent.id, group.id],
    importance: 8,
    payload: { group_id: group.id, name: group.name, kind: action.kind_of, doctrine },
  });
}

export async function joinGroup(agent: Agent, groupId: string): Promise<void> {
  const [group] = await db.select().from(schema.ideology_group).where(eq(schema.ideology_group.id, groupId)).limit(1);
  if (!group) return;
  await db
    .insert(schema.group_membership)
    .values({ agent_id: agent.id, group_id: group.id, role: 'member' })
    .onConflictDoNothing();
  await db.insert(schema.agent_memory).values({
    agent_id: agent.id,
    kind: 'belief',
    summary: `${agent.name} joined ${group.name} and started repeating its doctrine: ${group.doctrine}`,
    salience: 0.68,
    source_event_ids: [],
  });
  await writeEvent({
    kind: 'group_joined',
    actor_ids: [agent.id, group.id],
    importance: 6,
    payload: { group_id: group.id, name: group.name, kind: group.kind },
  });
}

export async function leaveGroup(agent: Agent, groupId: string): Promise<void> {
  const [group] = await db.select().from(schema.ideology_group).where(eq(schema.ideology_group.id, groupId)).limit(1);
  if (!group) return;
  await db.execute(sql`
    DELETE FROM ${schema.group_membership}
    WHERE agent_id = ${agent.id} AND group_id = ${groupId}
  `);
  await writeEvent({
    kind: 'group_left',
    actor_ids: [agent.id, group.id],
    importance: 5,
    payload: { group_id: group.id, name: group.name, kind: group.kind },
  });
}

export async function applyBeliefUpdates(limit = 30): Promise<number> {
  const agents = await db.execute<{
    id: string;
    name: string;
    traits: Agent['traits'];
    occupation: string | null;
  }>(sql`
    SELECT id, name, traits, occupation
    FROM ${schema.agent} a
    WHERE status = 'alive'
      AND NOT EXISTS (
        SELECT 1
        FROM ${schema.agent_memory} m
        WHERE m.agent_id = a.id
          AND m.kind = 'belief'
          AND m.t > now() - interval '2 minutes'
      )
    ORDER BY next_decision_at ASC
    LIMIT ${limit}
  `);

  let updated = 0;
  for (const agent of agents) {
    const events = await db.execute<{ id: number; kind: string }>(sql`
      SELECT id, kind
      FROM ${schema.world_event}
      WHERE actor_ids @> ARRAY[${agent.id}::uuid]
        AND t > now() - interval '30 minutes'
      ORDER BY t DESC
      LIMIT 20
    `);
    const groups = await db.execute<{ kind: string }>(sql`
      SELECT g.kind
      FROM ${schema.group_membership} m
      JOIN ${schema.ideology_group} g ON g.id = m.group_id
      WHERE m.agent_id = ${agent.id}
    `);

    const eventKinds = events.map((event) => event.kind);
    const delta = ideologyDelta(eventKinds, groups.map((group) => group.kind), agent.occupation);
    if (Math.abs(delta) < 0.005) continue;

    const current = Number(agent.traits.ideology_lean ?? 0);
    const next = Math.max(-1, Math.min(1, current + delta));
    const summary = beliefSummary(agent.name, current, next, eventKinds, groups.map((group) => group.kind));
    await db.execute(sql`
      UPDATE ${schema.agent}
      SET traits = jsonb_set(traits, '{ideology_lean}', to_jsonb(${next}::float), true),
          updated_at = now()
      WHERE id = ${agent.id}
    `);
    await db.insert(schema.agent_memory).values({
      agent_id: agent.id,
      kind: 'belief',
      summary,
      salience: 0.62,
      source_event_ids: events.slice(0, 8).map((event) => event.id),
    });
    await writeEvent({
      kind: 'agent_reflected',
      actor_ids: [agent.id],
      importance: 2,
      payload: { context: 'belief_update', ideology_lean: next, summary },
    });
    updated++;
  }
  return updated;
}

function ideologyDelta(eventKinds: string[], groupKinds: string[], occupation: string | null): number {
  let delta = 0;
  if (eventKinds.includes('city_aid_paid')) delta -= 0.05;
  if (eventKinds.includes('agent_paid_tax')) delta += 0.03;
  if (eventKinds.includes('agent_evicted')) delta -= 0.04;
  if (eventKinds.includes('agent_fired')) delta -= 0.04;
  if (eventKinds.includes('company_founded') || eventKinds.includes('trade_executed')) delta += 0.03;
  if (eventKinds.some((kind) => kind.startsWith('incident_'))) delta += 0.02;
  if (groupKinds.includes('union')) delta -= 0.03;
  if (groupKinds.includes('party')) delta += 0.01;
  if ((occupation ?? '').toLowerCase().includes('broker')) delta += 0.02;
  return Math.max(-0.08, Math.min(0.08, delta));
}

function beliefSummary(name: string, before: number, after: number, events: string[], groups: string[]): string {
  const direction = after < before ? 'public protection' : 'individual leverage';
  const cause = groups.length > 0 ? `${groups.join('/')} membership` : events.slice(0, 3).join(', ') || 'recent city life';
  return `${name}'s politics shifted toward ${direction} after ${cause}.`;
}
