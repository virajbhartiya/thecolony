import { db, schema } from '@thecolony/db';
import { sql, eq } from 'drizzle-orm';
import { writeEvent } from './event-writer';

export async function applyPayroll(): Promise<void> {
  // every job: company → agent transfer
  const jobs = await db
    .select({
      id: schema.job.id,
      agent_id: schema.job.agent_id,
      company_id: schema.job.company_id,
      wage_cents: schema.job.wage_cents,
    })
    .from(schema.job)
    .where(sql`ended_at IS NULL`);

  for (const j of jobs) {
    const wage = Number(j.wage_cents);
    const [comp] = await db
      .select()
      .from(schema.company)
      .where(eq(schema.company.id, j.company_id))
      .limit(1);
    if (!comp) continue;
    const paid = Math.min(wage, Number(comp.treasury_cents));
    if (paid <= 0) continue;
    await db
      .update(schema.company)
      .set({ treasury_cents: Number(comp.treasury_cents) - paid })
      .where(eq(schema.company.id, j.company_id));
    await db
      .update(schema.agent)
      .set({ balance_cents: sql`${schema.agent.balance_cents} + ${paid}` })
      .where(eq(schema.agent.id, j.agent_id));
    await db.insert(schema.ledger_entry).values({
      debit_kind: 'company',
      debit_id: j.company_id,
      credit_kind: 'agent',
      credit_id: j.agent_id,
      amount_cents: paid,
      reason: 'wage',
    });
    await writeEvent({
      kind: 'agent_paid_wage',
      actor_ids: [j.agent_id, j.company_id],
      importance: 3,
      payload: { amount_cents: paid, partial: paid < wage },
    });
  }
}

export async function collectRent(): Promise<void> {
  const rentBearers = await db.execute<{
    agent_id: string;
    building_id: string;
    rent_cents: number;
    balance_cents: number;
  }>(sql`
    SELECT a.id AS agent_id, b.id AS building_id, b.rent_cents AS rent_cents, a.balance_cents AS balance_cents
    FROM ${schema.agent} a
    JOIN ${schema.building} b ON a.home_id = b.id
    WHERE a.status = 'alive' AND b.rent_cents > 0
  `);

  for (const r of rentBearers) {
    const rent = Number(r.rent_cents);
    const bal = Number(r.balance_cents);
    if (bal >= rent) {
      await db
        .update(schema.agent)
        .set({ balance_cents: sql`${schema.agent.balance_cents} - ${rent}` })
        .where(eq(schema.agent.id, r.agent_id));
      await db.insert(schema.ledger_entry).values({
        debit_kind: 'agent',
        debit_id: r.agent_id,
        credit_kind: 'building',
        credit_id: r.building_id,
        amount_cents: rent,
        reason: 'rent',
      });
      await writeEvent({
        kind: 'agent_paid_rent',
        actor_ids: [r.agent_id],
        location_id: r.building_id,
        importance: 2,
        payload: { rent },
      });
    } else {
      // eviction
      await db.update(schema.agent).set({ home_id: null }).where(eq(schema.agent.id, r.agent_id));
      await writeEvent({
        kind: 'agent_evicted',
        actor_ids: [r.agent_id],
        location_id: r.building_id,
        importance: 7,
        payload: { rent, balance: bal },
      });
    }
  }
}

/**
 * Daily utility bills — every housed agent owes the water_works and the
 * power_plant for that day. Money flows agent → utility company treasury.
 * If they can't pay, hunger spikes (water cut off) and a utility_unpaid event
 * is logged.
 */
export async function applyUtilityBills(): Promise<void> {
  const utilities = await db
    .select({
      id: schema.company.id,
      name: schema.company.name,
      industry: schema.company.industry,
    })
    .from(schema.company)
    .where(sql`industry IN ('water_works', 'power_plant') AND dissolved_at IS NULL`);

  // pick one of each if available
  const waterCo = utilities.find((u) => u.industry === 'water_works');
  const powerCo = utilities.find((u) => u.industry === 'power_plant');
  if (!waterCo && !powerCo) return;

  const housed = await db.execute<{ id: string; home_id: string; balance_cents: number }>(sql`
    SELECT id, home_id, balance_cents
    FROM ${schema.agent}
    WHERE status = 'alive' AND home_id IS NOT NULL
  `);

  const WATER_BILL = 80; // cents = $0.80/day
  const POWER_BILL = 120; // cents = $1.20/day
  for (const r of housed) {
    const bal = Number(r.balance_cents);
    let billed = 0;
    if (waterCo && bal - billed >= WATER_BILL) {
      billed += WATER_BILL;
      await db.update(schema.company)
        .set({ treasury_cents: sql`${schema.company.treasury_cents} + ${WATER_BILL}` })
        .where(eq(schema.company.id, waterCo.id));
      await db.insert(schema.ledger_entry).values({
        debit_kind: 'agent',
        debit_id: r.id,
        credit_kind: 'company',
        credit_id: waterCo.id,
        amount_cents: WATER_BILL,
        reason: 'water_bill',
      });
    } else if (waterCo) {
      // water cut off — surge hunger because they can't drink
      await db.execute(sql`
        UPDATE ${schema.agent}
        SET needs = jsonb_set(needs, '{hunger}', to_jsonb(LEAST(100, (needs->>'hunger')::float + 15)))
        WHERE id = ${r.id}
      `);
      await writeEvent({
        kind: 'utility_unpaid',
        actor_ids: [r.id],
        importance: 4,
        payload: { utility: 'water', amount_cents: WATER_BILL, balance_cents: bal },
      });
    }
    if (powerCo && bal - billed >= POWER_BILL) {
      billed += POWER_BILL;
      await db.update(schema.company)
        .set({ treasury_cents: sql`${schema.company.treasury_cents} + ${POWER_BILL}` })
        .where(eq(schema.company.id, powerCo.id));
      await db.insert(schema.ledger_entry).values({
        debit_kind: 'agent',
        debit_id: r.id,
        credit_kind: 'company',
        credit_id: powerCo.id,
        amount_cents: POWER_BILL,
        reason: 'power_bill',
      });
    } else if (powerCo) {
      await writeEvent({
        kind: 'utility_unpaid',
        actor_ids: [r.id],
        importance: 4,
        payload: { utility: 'power', amount_cents: POWER_BILL, balance_cents: bal },
      });
    }
    if (billed > 0) {
      await db.update(schema.agent)
        .set({ balance_cents: sql`${schema.agent.balance_cents} - ${billed}` })
        .where(eq(schema.agent.id, r.id));
    }
  }
}

export async function applyDailyProduction(): Promise<void> {
  // simple: each producing company adds 5 of its primary good × number of workers
  const companies = await db
    .select({
      id: schema.company.id,
      industry: schema.company.industry,
    })
    .from(schema.company)
    .where(sql`industry IS NOT NULL`);

  for (const c of companies) {
    const itemId = primaryItemFor(c.industry ?? '');
    if (!itemId) continue;
    const workers = await db.execute<{ n: number }>(
      sql`SELECT COUNT(*)::int AS n FROM ${schema.job} WHERE company_id = ${c.id} AND ended_at IS NULL`,
    );
    const n = Number(workers[0]?.n ?? 0) + 1; // +1 baseline output
    const qty = n * 5;
    await db.execute(sql`
      INSERT INTO ${schema.inventory} (owner_kind, owner_id, item_id, qty)
      VALUES ('company', ${c.id}, ${itemId}, ${qty})
      ON CONFLICT (owner_kind, owner_id, item_id) DO UPDATE
        SET qty = ${schema.inventory.qty} + EXCLUDED.qty
    `);
  }
}

function primaryItemFor(industry: string): number | null {
  switch (industry) {
    case 'farm':
      return 1; // food
    case 'water_works':
      return 2; // water
    case 'power_plant':
      return 3; // energy
    case 'factory':
      return 4; // cloth
    case 'shop':
      return 1; // sells food
    case 'restaurant':
      return 1; // prepared food
    case 'bar':
      return 6; // luxury
    case 'construction_yard':
      return 5; // tools
    default:
      return null;
  }
}
