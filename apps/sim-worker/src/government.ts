import { db, schema } from '@thecolony/db';
import { CITY_TREASURY_ID } from '@thecolony/domain';
import { hashStringSeed, mulberry32 } from '@thecolony/sim';
import { eq, sql } from 'drizzle-orm';
import { writeEvent } from './event-writer';

const GOVERNMENT_KEY = 'government';
const DEFAULT_TAX_RATE_BPS = 850;
const TERM_MS = 5 * 60 * 1000;

export interface GovernmentState {
  mayor_id: string | null;
  mayor_name: string | null;
  treasury_cents: number;
  tax_rate_bps: number;
  election_id: string | null;
  next_election_at: string | null;
  turnout: number | null;
}

export async function ensureGovernment(): Promise<GovernmentState> {
  const existing = await readGovernment();
  if (existing) return existing;

  const [mayor] = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, name
    FROM ${schema.agent}
    WHERE status = 'alive'
    ORDER BY ((traits->>'ambition')::float + (traits->>'sociability')::float + balance_cents / 50000.0) DESC
    LIMIT 1
  `);

  const state: GovernmentState = {
    mayor_id: mayor?.id ?? null,
    mayor_name: mayor?.name ?? null,
    treasury_cents: 250000,
    tax_rate_bps: DEFAULT_TAX_RATE_BPS,
    election_id: 'founding-election',
    next_election_at: new Date(Date.now() + TERM_MS).toISOString(),
    turnout: null,
  };
  await writeGovernment(state);
  await writeEvent({
    kind: 'city_founded',
    actor_ids: mayor?.id ? [mayor.id] : [],
    importance: 8,
    payload: {
      mayor_name: mayor?.name ?? 'none',
      treasury_cents: state.treasury_cents,
      tax_rate_bps: state.tax_rate_bps,
    },
  });
  return state;
}

export async function readGovernment(): Promise<GovernmentState | null> {
  const rows = await db.select().from(schema.city_state).where(eq(schema.city_state.key, GOVERNMENT_KEY)).limit(1);
  return (rows[0]?.value as GovernmentState | undefined) ?? null;
}

export async function applyCivicCycle(): Promise<void> {
  const state = await ensureGovernment();
  const afterTax = await collectTaxes(state);
  const afterAid = await payAid(afterTax);
  await runElectionIfDue(afterAid);
}

export async function spendCityTreasury(amountCents: number): Promise<number> {
  const state = await ensureGovernment();
  const paid = Math.max(0, Math.min(Math.floor(amountCents), state.treasury_cents));
  if (paid <= 0) return 0;
  await writeGovernment({ ...state, treasury_cents: state.treasury_cents - paid });
  return paid;
}

async function collectTaxes(state: GovernmentState): Promise<GovernmentState> {
  const taxpayers = await db.execute<{ id: string; name: string; balance_cents: number }>(sql`
    SELECT id, name, balance_cents
    FROM ${schema.agent}
    WHERE status = 'alive' AND balance_cents > 1800
    ORDER BY balance_cents DESC
    LIMIT 40
  `);

  let total = 0;
  const taxedIds: string[] = [];
  for (const row of taxpayers) {
    const tax = Math.floor((Number(row.balance_cents) * state.tax_rate_bps) / 10000);
    if (tax <= 0) continue;
    total += tax;
    taxedIds.push(row.id);
    await db
      .update(schema.agent)
      .set({ balance_cents: sql`${schema.agent.balance_cents} - ${tax}` })
      .where(eq(schema.agent.id, row.id));
    await db.insert(schema.ledger_entry).values({
      debit_kind: 'agent',
      debit_id: row.id,
      credit_kind: 'city',
      credit_id: CITY_TREASURY_ID,
      amount_cents: tax,
      reason: 'tax',
    });
  }

  if (total <= 0) return state;
  const next = { ...state, treasury_cents: state.treasury_cents + total };
  await writeGovernment(next);
  await writeEvent({
    kind: 'city_tax_collected',
    actor_ids: taxedIds.slice(0, 20),
    importance: 5,
    payload: {
      amount_cents: total,
      taxpayer_count: taxedIds.length,
      tax_rate_bps: state.tax_rate_bps,
      treasury_cents: next.treasury_cents,
    },
  });
  return next;
}

async function payAid(state: GovernmentState): Promise<GovernmentState> {
  const recipients = await db.execute<{ id: string; name: string; balance_cents: number; home_id: string | null }>(sql`
    SELECT id, name, balance_cents, home_id
    FROM ${schema.agent}
    WHERE status = 'alive' AND (balance_cents < 1200 OR home_id IS NULL)
    ORDER BY balance_cents ASC
    LIMIT 5
  `);

  let treasury = state.treasury_cents;
  let total = 0;
  for (const row of recipients) {
    const amount = row.home_id ? 700 : 1100;
    if (treasury < amount) break;
    treasury -= amount;
    total += amount;
    await db
      .update(schema.agent)
      .set({ balance_cents: sql`${schema.agent.balance_cents} + ${amount}` })
      .where(eq(schema.agent.id, row.id));
    await db.insert(schema.ledger_entry).values({
      debit_kind: 'city',
      debit_id: CITY_TREASURY_ID,
      credit_kind: 'agent',
      credit_id: row.id,
      amount_cents: amount,
      reason: 'public_aid',
    });
    await writeEvent({
      kind: 'city_aid_paid',
      actor_ids: [row.id],
      importance: 4,
      payload: { amount_cents: amount, reason: row.home_id ? 'poverty' : 'homelessness' },
    });
  }

  if (total <= 0) return state;
  const next = { ...state, treasury_cents: treasury };
  await writeGovernment(next);
  return next;
}

async function runElectionIfDue(state: GovernmentState): Promise<GovernmentState> {
  if (state.next_election_at && new Date(state.next_election_at).getTime() > Date.now()) return state;

  const electionId = `election-${Date.now()}`;
  const candidates = await db.execute<{
    id: string;
    name: string;
    balance_cents: number;
    ambition: number;
    sociability: number;
    ideology: number;
  }>(sql`
    SELECT id, name, balance_cents,
      (traits->>'ambition')::float AS ambition,
      (traits->>'sociability')::float AS sociability,
      (traits->>'ideology_lean')::float AS ideology
    FROM ${schema.agent}
    WHERE status = 'alive'
    ORDER BY ((traits->>'ambition')::float + (traits->>'sociability')::float + balance_cents / 40000.0) DESC
    LIMIT 4
  `);
  if (candidates.length === 0) return state;

  const voters = await db.execute<{ id: string; name: string; greed: number; empathy: number; ideology: number }>(sql`
    SELECT id, name,
      (traits->>'greed')::float AS greed,
      (traits->>'empathy')::float AS empathy,
      (traits->>'ideology_lean')::float AS ideology
    FROM ${schema.agent}
    WHERE status = 'alive'
  `);

  const totals = new Map<string, number>();
  for (const c of candidates) totals.set(c.id, 0);

  let visibleVotes = 0;
  for (const voter of voters) {
    const rng = mulberry32(hashStringSeed(`${electionId}:${voter.id}`));
    let best = candidates[0]!;
    let bestScore = -Infinity;
    for (const c of candidates) {
      const ideologyFit = 1 - Math.min(2, Math.abs(Number(voter.ideology) - Number(c.ideology))) / 2;
      const score =
        Number(c.ambition) * 0.35 +
        Number(c.sociability) * 0.25 +
        ideologyFit * 0.25 +
        Number(c.balance_cents) / 100000 +
        rng() * 0.18 -
        Number(voter.greed) * Math.max(0, Number(c.ideology) * -0.08);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    totals.set(best.id, (totals.get(best.id) ?? 0) + 1);
    const reason = Number(best.ideology) < 0 ? 'public services' : 'lower taxes';
    await db.insert(schema.city_vote).values({
      election_id: electionId,
      voter_id: voter.id,
      candidate_id: best.id,
      reason,
    });
    if (visibleVotes < 3) {
      visibleVotes++;
      await writeEvent({
        kind: 'vote_cast',
        actor_ids: [voter.id, best.id],
        importance: 2,
        payload: { voter: voter.name, candidate: best.name, reason },
      });
    }
  }

  const winner = candidates
    .map((c) => ({ ...c, votes: totals.get(c.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes)[0]!;
  const taxRate = Math.round(700 + (1 - Number(winner.ideology)) * 250);
  const next: GovernmentState = {
    ...state,
    mayor_id: winner.id,
    mayor_name: winner.name,
    tax_rate_bps: taxRate,
    election_id: electionId,
    next_election_at: new Date(Date.now() + TERM_MS).toISOString(),
    turnout: voters.length,
  };
  await writeGovernment(next);
  await writeEvent({
    kind: 'mayor_elected',
    actor_ids: [winner.id],
    importance: 9,
    payload: {
      mayor_name: winner.name,
      votes: winner.votes,
      turnout: voters.length,
      tax_rate_bps: taxRate,
      candidates: candidates.map((c) => ({ id: c.id, name: c.name, votes: totals.get(c.id) ?? 0 })),
    },
  });
  return next;
}

async function writeGovernment(state: GovernmentState): Promise<void> {
  await db
    .insert(schema.city_state)
    .values({ key: GOVERNMENT_KEY, value: state, updated_at: new Date() })
    .onConflictDoUpdate({
      target: schema.city_state.key,
      set: { value: state, updated_at: new Date() },
    });
}
