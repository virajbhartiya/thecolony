import { db, schema } from '@thecolony/db';
import { eq, sql } from 'drizzle-orm';
import { CITY_TREASURY_ID, type WorldEventKind } from '@thecolony/domain';
import { writeEvent } from './event-writer';
import { spendCityTreasury } from './government';

const JAIL_SECONDS_PER_SEVERITY = 25;
const COURT_LIMIT = 8;

interface IncidentArgs {
  kind: 'theft' | 'assault' | 'fraud' | 'breach';
  perp_id: string;
  victim_id?: string | null;
  severity: number;
  amount_cents?: number;
  location_id?: string | null;
  evidence_event_ids?: number[];
}

interface IncidentRow extends Record<string, unknown> {
  id: string;
  kind: string;
  perp_id: string | null;
  victim_id: string | null;
  severity: number;
  warrants: number;
  bounty_cents: number;
  amount_cents: number;
  evidence_count: number;
}

export async function createIncident(args: IncidentArgs): Promise<string> {
  const [incident] = await db
    .insert(schema.incident)
    .values({
      kind: args.kind,
      perp_id: args.perp_id,
      victim_id: args.victim_id ?? null,
      severity: args.severity,
      resolved: false,
      evidence_event_ids: args.evidence_event_ids ?? [],
    })
    .returning({ id: schema.incident.id });
  if (!incident) throw new Error('incident insert failed');

  const eventId = await writeEvent({
    kind: incidentEventKind(args.kind),
    actor_ids: [args.perp_id, args.victim_id].filter((id): id is string => Boolean(id)),
    location_id: args.location_id ?? null,
    importance: Math.min(10, 5 + args.severity),
    payload: {
      incident_id: incident.id,
      amount_cents: args.amount_cents ?? 0,
      severity: args.severity,
    },
  });
  await db
    .update(schema.incident)
    .set({ evidence_event_ids: [...(args.evidence_event_ids ?? []), eventId] })
    .where(eq(schema.incident.id, incident.id));
  await recordWitnessesAndReports(incident.id, args);
  return incident.id;
}

export async function accuseAgent(
  accuserId: string,
  targetId: string,
  charge: string,
  incidentId?: string | null,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO ${schema.legal_status} (agent_id, warrants, bounty_cents, updated_at)
    VALUES (${targetId}, 1, 0, now())
    ON CONFLICT (agent_id) DO UPDATE
      SET warrants = ${schema.legal_status.warrants} + 1,
          bounty_cents = CASE
            WHEN ${schema.legal_status.warrants} + 1 > 3
            THEN GREATEST(${schema.legal_status.bounty_cents}, (${schema.legal_status.warrants} + 1) * 500)
            ELSE ${schema.legal_status.bounty_cents}
          END,
          updated_at = now()
  `);
  await writeEvent({
    kind: 'agent_accused',
    actor_ids: [accuserId, targetId],
    importance: 6,
    payload: { charge, incident_id: incidentId ?? null },
  });
}

export async function applyCourtSession(limit = COURT_LIMIT): Promise<number> {
  const rows = await db.execute<IncidentRow>(sql`
    SELECT i.id, i.kind, i.perp_id, i.victim_id, i.severity,
      COALESCE(l.warrants, 0)::int AS warrants,
      COALESCE(l.bounty_cents, 0)::bigint AS bounty_cents,
      COALESCE((
        SELECT MAX((e.payload->>'amount_cents')::bigint)
        FROM ${schema.world_event} e
        WHERE e.payload->>'incident_id' = i.id::text
          AND e.kind LIKE 'incident_%'
      ), 0)::bigint AS amount_cents,
      COALESCE((
        SELECT COUNT(*)::int
        FROM ${schema.world_event} e
        WHERE e.payload->>'incident_id' = i.id::text
          AND e.kind IN ('incident_witnessed', 'agent_accused')
      ), 0)::int AS evidence_count
    FROM ${schema.incident} i
    LEFT JOIN ${schema.legal_status} l ON l.agent_id = i.perp_id
    WHERE i.resolved = false AND i.perp_id IS NOT NULL
    ORDER BY i.t ASC
    LIMIT ${limit}
  `);

  let processed = 0;
  for (const incident of rows) {
    if (!incident.perp_id) continue;
    // Pull the defendant into the courthouse for the trial.
    await summonToCourt(incident.perp_id);
    const guilty = Number(incident.severity) + Number(incident.warrants) + Number(incident.evidence_count) >= 2;
    if (!guilty) {
      await db.update(schema.incident).set({ resolved: true }).where(eq(schema.incident.id, incident.id));
      await writeEvent({
        kind: 'court_verdict',
        actor_ids: [incident.perp_id, incident.victim_id].filter((id): id is string => Boolean(id)),
        importance: 5,
        payload: { incident_id: incident.id, charge: incident.kind, guilty: false },
      });
      processed++;
      continue;
    }

    const jailUntil = new Date(Date.now() + Math.max(20, Number(incident.severity) * JAIL_SECONDS_PER_SEVERITY) * 1000);
    const jailUntilIso = jailUntil.toISOString();
    const damages = damagesForIncident(incident.kind, Number(incident.amount_cents), Number(incident.severity));
    const paid = await payCivilDamages(incident.perp_id, incident.victim_id, damages);
    const debt = Math.max(0, damages - paid);
    const bounty = await payBounty(incident.id, incident.perp_id, Number(incident.bounty_cents));

    await db.update(schema.incident).set({ resolved: true }).where(eq(schema.incident.id, incident.id));
    await db.execute(sql`
      INSERT INTO ${schema.legal_status} (agent_id, warrants, debts_cents, jail_until, updated_at)
      VALUES (${incident.perp_id}, 0, ${debt}, ${jailUntilIso}::timestamptz, now())
      ON CONFLICT (agent_id) DO UPDATE
        SET warrants = 0,
            bounty_cents = 0,
            debts_cents = ${schema.legal_status.debts_cents} + ${debt},
            jail_until = ${jailUntilIso}::timestamptz,
            updated_at = now()
    `);
    await moveToJail(incident.perp_id);
    await writeEvent({
      kind: 'court_verdict',
      actor_ids: [incident.perp_id, incident.victim_id].filter((id): id is string => Boolean(id)),
      importance: 8,
      payload: {
        incident_id: incident.id,
        charge: incident.kind,
        guilty: true,
        jail_until: jailUntil.toISOString(),
        damages_cents: damages,
        paid_cents: paid,
        debt_cents: debt,
        bounty_paid_cents: bounty.paid_cents,
        bounty_hunter_id: bounty.hunter_id,
      },
    });
    await writeEvent({
      kind: 'agent_jailed',
      actor_ids: [incident.perp_id],
      importance: 8,
      payload: { incident_id: incident.id, charge: incident.kind, jail_until: jailUntil.toISOString() },
    });
    processed++;
  }
  return processed;
}

async function payBounty(
  incidentId: string,
  perpId: string,
  bountyCents: number,
): Promise<{ hunter_id: string | null; paid_cents: number }> {
  if (bountyCents <= 0) return { hunter_id: null, paid_cents: 0 };

  const rows = await db.execute<{ hunter_id: string }>(sql`
    SELECT e.actor_ids[1] AS hunter_id
    FROM ${schema.world_event} e
    WHERE e.kind = 'agent_accused'
      AND e.payload->>'incident_id' = ${incidentId}
      AND e.actor_ids[2] = ${perpId}::uuid
      AND e.actor_ids[1] <> ${perpId}::uuid
    ORDER BY e.t DESC
    LIMIT 1
  `);
  const hunterId = rows[0]?.hunter_id ?? null;
  if (!hunterId) return { hunter_id: null, paid_cents: 0 };

  const paid = await spendCityTreasury(bountyCents);
  if (paid <= 0) return { hunter_id: hunterId, paid_cents: 0 };

  await db
    .update(schema.agent)
    .set({ balance_cents: sql`${schema.agent.balance_cents} + ${paid}` })
    .where(eq(schema.agent.id, hunterId));
  await db.insert(schema.ledger_entry).values({
    debit_kind: 'city',
    debit_id: CITY_TREASURY_ID,
    credit_kind: 'agent',
    credit_id: hunterId,
    amount_cents: paid,
    reason: 'bounty',
  });
  await writeEvent({
    kind: 'bounty_paid',
    actor_ids: [hunterId, perpId],
    importance: 8,
    payload: { incident_id: incidentId, amount_cents: paid },
  });

  return { hunter_id: hunterId, paid_cents: paid };
}

export async function releaseJailedAgents(): Promise<number> {
  const rows = await db.execute<{ agent_id: string }>(sql`
    SELECT l.agent_id
    FROM ${schema.legal_status} l
    JOIN ${schema.agent} a ON a.id = l.agent_id
    WHERE a.status = 'jailed'
      AND l.jail_until IS NOT NULL
      AND l.jail_until <= now()
  `);

  for (const row of rows) {
    const paroleUntil = new Date(Date.now() + 5 * 60_000);
    const paroleUntilIso = paroleUntil.toISOString();
    await db
      .update(schema.agent)
      .set({ status: 'alive', state: 'idle', next_decision_at: new Date(Date.now() + 5000), updated_at: new Date() })
      .where(eq(schema.agent.id, row.agent_id));
    await db.execute(sql`
      UPDATE ${schema.legal_status}
      SET jail_until = NULL, parole_until = ${paroleUntilIso}::timestamptz, updated_at = now()
      WHERE agent_id = ${row.agent_id}
    `);
    await writeEvent({
      kind: 'agent_released',
      actor_ids: [row.agent_id],
      importance: 7,
      payload: { parole_until: paroleUntil.toISOString() },
    });
  }
  return rows.length;
}

async function recordWitnessesAndReports(incidentId: string, args: IncidentArgs): Promise<void> {
  const [perp] = await db
    .select({ pos_x: schema.agent.pos_x, pos_y: schema.agent.pos_y })
    .from(schema.agent)
    .where(eq(schema.agent.id, args.perp_id))
    .limit(1);
  if (!perp) return;
  const victimId = args.victim_id ?? null;

  const witnesses = await db.execute<{
    id: string;
    empathy: number;
    affinity_to_victim: number;
  }>(sql`
    SELECT a.id,
      COALESCE((a.traits->>'empathy')::float, 0.5) AS empathy,
      COALESCE(r.affinity, 0)::int AS affinity_to_victim
    FROM ${schema.agent} a
    LEFT JOIN ${schema.agent_relationship} r ON r.subj_id = a.id AND r.obj_id = ${victimId ?? args.perp_id}
    WHERE a.status = 'alive'
      AND a.id <> ${args.perp_id}
      AND (${victimId}::uuid IS NULL OR a.id <> ${victimId})
    ORDER BY ((a.pos_x - ${perp.pos_x})^2 + (a.pos_y - ${perp.pos_y})^2) ASC
    LIMIT 5
  `);

  let reported = false;
  for (const witness of witnesses) {
    await writeEvent({
      kind: 'incident_witnessed',
      actor_ids: [witness.id, args.perp_id, args.victim_id].filter((id): id is string => Boolean(id)),
      location_id: args.location_id ?? null,
      importance: 5,
      payload: { incident_id: incidentId, charge: args.kind },
    });
    const reportScore = Number(witness.empathy) + Math.max(0, Number(witness.affinity_to_victim)) / 120;
    if (!reported && reportScore >= 0.45) {
      await accuseAgent(witness.id, args.perp_id, args.kind, incidentId);
      reported = true;
    }
  }

  if (!reported && witnesses[0]) {
    await accuseAgent(witnesses[0].id, args.perp_id, args.kind, incidentId);
  }
}

async function payCivilDamages(perpId: string, victimId: string | null, damages: number): Promise<number> {
  if (!victimId || damages <= 0) return 0;
  const rows = await db.execute<{ balance_cents: number }>(sql`
    SELECT balance_cents FROM ${schema.agent}
    WHERE id = ${perpId}
    LIMIT 1
  `);
  const paid = Math.max(0, Math.min(Number(rows[0]?.balance_cents ?? 0), damages));
  if (paid <= 0) return 0;
  await db
    .update(schema.agent)
    .set({ balance_cents: sql`${schema.agent.balance_cents} - ${paid}` })
    .where(eq(schema.agent.id, perpId));
  await db
    .update(schema.agent)
    .set({ balance_cents: sql`${schema.agent.balance_cents} + ${paid}` })
    .where(eq(schema.agent.id, victimId));
  await db.insert(schema.ledger_entry).values({
    debit_kind: 'agent',
    debit_id: perpId,
    credit_kind: 'agent',
    credit_id: victimId,
    amount_cents: paid,
    reason: 'civil_damages',
  });
  return paid;
}

async function moveToJail(agentId: string): Promise<void> {
  const [jail] = await db.select().from(schema.building).where(eq(schema.building.kind, 'jail')).limit(1);
  const updates: {
    status: string;
    state: string;
    pos_x?: number;
    pos_y?: number;
    target_x?: number;
    target_y?: number;
    updated_at: Date;
  } = {
    status: 'jailed',
    state: 'jailed',
    updated_at: new Date(),
  };
  if (jail) {
    // Teleport into the cell — no leisurely walk to prison.
    const px = jail.tile_x + 0.5;
    const py = jail.tile_y + 0.5;
    updates.pos_x = px;
    updates.pos_y = py;
    updates.target_x = px;
    updates.target_y = py;
  }
  await db
    .update(schema.agent)
    .set(updates)
    .where(eq(schema.agent.id, agentId));
}

/**
 * Pull a defendant into the courthouse so they're physically inside it
 * during their trial. Called before each verdict.
 */
export async function summonToCourt(agentId: string): Promise<void> {
  const [court] = await db
    .select()
    .from(schema.building)
    .where(eq(schema.building.kind, 'court'))
    .limit(1);
  if (!court) return;
  const px = court.tile_x + 0.5 + (Math.random() - 0.5) * 0.6;
  const py = court.tile_y + 0.5 + (Math.random() - 0.5) * 0.6;
  await db
    .update(schema.agent)
    .set({
      pos_x: px,
      pos_y: py,
      target_x: px,
      target_y: py,
      state: 'speaking',
      updated_at: new Date(),
    })
    .where(eq(schema.agent.id, agentId));
}

function incidentEventKind(kind: IncidentArgs['kind']): WorldEventKind {
  switch (kind) {
    case 'theft':
      return 'incident_theft';
    case 'assault':
      return 'incident_assault';
    case 'fraud':
      return 'incident_fraud';
    case 'breach':
      return 'incident_breach';
  }
}

function damagesForIncident(kind: string, amount: number, severity: number): number {
  if (amount > 0) return amount;
  if (kind === 'assault') return severity * 1000;
  if (kind === 'breach') return severity * 750;
  return severity * 500;
}
