import { db, schema } from '@thecolony/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { writeEvent } from './event-writer';

const INITIAL_SHARES = 1000;
const SEED_ASK_QTY = 25;

type OrderRow = Record<string, unknown> & {
  id: string;
  asset: string;
  agent_id: string;
  ref_id: string | null;
  price_cents: number;
  qty: number;
  filled_qty: number;
};

export function shareAsset(companyId: string): string {
  return `shares:${companyId}`;
}

export function tickerForCompany(name: string, id: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'COL';
  return `${letters}${id.replace(/-/g, '').slice(0, 2).toUpperCase()}`.slice(0, 5);
}

export async function ensureEquityMarket(): Promise<void> {
  const companies = await db
    .select({
      id: schema.company.id,
      name: schema.company.name,
      founder_id: schema.company.founder_id,
      ticker: schema.company.ticker,
    })
    .from(schema.company)
    .where(and(isNull(schema.company.dissolved_at), sql`${schema.company.building_id} IS NOT NULL`));

  for (const company of companies) {
    const ticker = company.ticker ?? tickerForCompany(company.name, company.id);
    if (!company.ticker) {
      await db.update(schema.company).set({ ticker }).where(eq(schema.company.id, company.id));
    }

    if (company.founder_id) {
      await db.execute(sql`
        INSERT INTO ${schema.company_member} (agent_id, company_id, role)
        VALUES (${company.founder_id}, ${company.id}, 'founder'), (${company.founder_id}, ${company.id}, 'exec')
        ON CONFLICT DO NOTHING
      `);
    }

    const existing = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM ${schema.share_holding}
      WHERE company_id = ${company.id}
    `);
    const holderId = company.founder_id ?? (await firstBrokerId());
    if (Number(existing[0]?.n ?? 0) === 0 && holderId) {
      await db.execute(sql`
        INSERT INTO ${schema.share_holding} (agent_id, company_id, shares)
        VALUES (${holderId}, ${company.id}, ${INITIAL_SHARES})
        ON CONFLICT (agent_id, company_id) DO UPDATE
          SET shares = ${schema.share_holding.shares} + EXCLUDED.shares,
              updated_at = now()
      `);
      await db.execute(sql`
        INSERT INTO ${schema.company_member} (agent_id, company_id, role)
        VALUES (${holderId}, ${company.id}, 'shareholder')
        ON CONFLICT DO NOTHING
      `);
      await writeEvent({
        kind: 'shares_issued',
        actor_ids: [holderId, company.id],
        importance: 7,
        payload: { company: company.name, ticker, shares: INITIAL_SHARES, price_cents: 100 },
      });
    }

    await seedAskIfBookIsEmpty(company.id, holderId, ticker);
  }
}

export async function clearMarketOrders(maxTrades = 40): Promise<number> {
  await db
    .update(schema.market_order)
    .set({ status: 'expired' })
    .where(sql`${schema.market_order.status} IN ('open','partial') AND ${schema.market_order.ttl_t} IS NOT NULL AND ${schema.market_order.ttl_t} < now()`);

  const assets = await db.execute<{ asset: string }>(sql`
    SELECT DISTINCT asset
    FROM ${schema.market_order}
    WHERE status IN ('open','partial') AND qty > filled_qty
    ORDER BY asset
  `);

  let trades = 0;
  for (const row of assets) {
    while (trades < maxTrades) {
      const buy = await bestOrder(row.asset, 'buy');
      const sell = await bestOrder(row.asset, 'sell');
      if (!buy || !sell || Number(buy.price_cents) < Number(sell.price_cents)) break;

      const companyId = companyIdFromAsset(row.asset) ?? buy.ref_id ?? sell.ref_id;
      if (!companyId) break;

      const remainingBuy = Number(buy.qty) - Number(buy.filled_qty);
      const remainingSell = Number(sell.qty) - Number(sell.filled_qty);
      const qty = Math.min(remainingBuy, remainingSell);
      const price = Math.max(1, Math.floor((Number(buy.price_cents) + Number(sell.price_cents)) / 2));
      const amount = qty * price;

      const buyer = await agentBalance(buy.agent_id);
      if (buyer < amount) {
        await cancelOrder(buy.id);
        continue;
      }

      const sellerShares = await holdingShares(sell.agent_id, companyId);
      if (sellerShares < qty) {
        await cancelOrder(sell.id);
        continue;
      }

      await settleTrade({ buy, sell, companyId, qty, price, amount });
      trades++;
    }
    if (trades >= maxTrades) break;
  }

  return trades;
}

async function seedAskIfBookIsEmpty(companyId: string, holderId: string | null, ticker: string): Promise<void> {
  if (!holderId) return;
  const asset = shareAsset(companyId);
  const existing = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
    FROM ${schema.market_order}
    WHERE asset = ${asset} AND status IN ('open','partial') AND kind = 'sell'
  `);
  if (Number(existing[0]?.n ?? 0) > 0) return;

  const shares = await holdingShares(holderId, companyId);
  if (shares < SEED_ASK_QTY) return;
  await db.insert(schema.market_order).values({
    kind: 'sell',
    asset,
    agent_id: holderId,
    ref_id: companyId,
    price_cents: baselinePriceForTicker(ticker),
    qty: SEED_ASK_QTY,
    ttl_t: new Date(Date.now() + 30 * 60_000),
  });
  await writeEvent({
    kind: 'order_placed',
    actor_ids: [holderId, companyId],
    importance: 4,
    payload: { side: 'sell', asset, ticker, qty: SEED_ASK_QTY, price_cents: baselinePriceForTicker(ticker) },
  });
}

async function bestOrder(asset: string, kind: 'buy' | 'sell'): Promise<OrderRow | null> {
  const ordering =
    kind === 'buy'
      ? sql`${schema.market_order.price_cents} DESC, ${schema.market_order.t} ASC`
      : sql`${schema.market_order.price_cents} ASC, ${schema.market_order.t} ASC`;
  const rows = await db.execute<OrderRow>(sql`
    SELECT id, asset, agent_id, ref_id, price_cents, qty, filled_qty
    FROM ${schema.market_order}
    WHERE asset = ${asset}
      AND kind = ${kind}
      AND status IN ('open','partial')
      AND qty > filled_qty
      AND (ttl_t IS NULL OR ttl_t > now())
    ORDER BY ${ordering}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function settleTrade({
  buy,
  sell,
  companyId,
  qty,
  price,
  amount,
}: {
  buy: OrderRow;
  sell: OrderRow;
  companyId: string;
  qty: number;
  price: number;
  amount: number;
}): Promise<void> {
  await db
    .update(schema.agent)
    .set({ balance_cents: sql`${schema.agent.balance_cents} - ${amount}` })
    .where(eq(schema.agent.id, buy.agent_id));
  await db
    .update(schema.agent)
    .set({ balance_cents: sql`${schema.agent.balance_cents} + ${amount}` })
    .where(eq(schema.agent.id, sell.agent_id));
  await db.execute(sql`
    UPDATE ${schema.share_holding}
    SET shares = shares - ${qty}, updated_at = now()
    WHERE agent_id = ${sell.agent_id} AND company_id = ${companyId}
  `);
  await db.execute(sql`
    INSERT INTO ${schema.share_holding} (agent_id, company_id, shares)
    VALUES (${buy.agent_id}, ${companyId}, ${qty})
    ON CONFLICT (agent_id, company_id) DO UPDATE
      SET shares = ${schema.share_holding.shares} + EXCLUDED.shares,
          updated_at = now()
  `);
  await db.execute(sql`
    INSERT INTO ${schema.company_member} (agent_id, company_id, role)
    VALUES (${buy.agent_id}, ${companyId}, 'shareholder')
    ON CONFLICT DO NOTHING
  `);
  await db.insert(schema.ledger_entry).values({
    debit_kind: 'agent',
    debit_id: buy.agent_id,
    credit_kind: 'agent',
    credit_id: sell.agent_id,
    amount_cents: amount,
    reason: 'share_trade',
  });
  await advanceOrder(buy.id, qty, Number(buy.qty) - Number(buy.filled_qty));
  await advanceOrder(sell.id, qty, Number(sell.qty) - Number(sell.filled_qty));
  await db.insert(schema.price_observation).values({
    asset: shareAsset(companyId),
    price_cents: price,
    qty,
  });

  const [company] = await db
    .select({ name: schema.company.name, ticker: schema.company.ticker })
    .from(schema.company)
    .where(eq(schema.company.id, companyId))
    .limit(1);

  await writeEvent({
    kind: 'trade_executed',
    actor_ids: [buy.agent_id, sell.agent_id, companyId],
    importance: 6,
    payload: {
      asset: shareAsset(companyId),
      company: company?.name ?? 'Unknown company',
      ticker: company?.ticker ?? tickerForCompany(company?.name ?? 'COL', companyId),
      qty,
      price_cents: price,
      amount_cents: amount,
    },
  });
}

async function advanceOrder(id: string, fillQty: number, remainingBeforeFill: number): Promise<void> {
  await db
    .update(schema.market_order)
    .set({
      filled_qty: sql`${schema.market_order.filled_qty} + ${fillQty}`,
      status: fillQty >= remainingBeforeFill ? 'filled' : 'partial',
    })
    .where(eq(schema.market_order.id, id));
}

async function cancelOrder(id: string): Promise<void> {
  await db.update(schema.market_order).set({ status: 'cancelled' }).where(eq(schema.market_order.id, id));
}

async function agentBalance(id: string): Promise<number> {
  const rows = await db.execute<{ balance_cents: number }>(sql`
    SELECT balance_cents FROM ${schema.agent}
    WHERE id = ${id} AND status = 'alive'
    LIMIT 1
  `);
  return Number(rows[0]?.balance_cents ?? 0);
}

async function holdingShares(agentId: string, companyId: string): Promise<number> {
  const rows = await db.execute<{ shares: number }>(sql`
    SELECT shares FROM ${schema.share_holding}
    WHERE agent_id = ${agentId} AND company_id = ${companyId}
    LIMIT 1
  `);
  return Number(rows[0]?.shares ?? 0);
}

async function firstBrokerId(): Promise<string | null> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT id FROM ${schema.agent}
    WHERE status = 'alive' AND lower(coalesce(occupation, '')) LIKE '%broker%'
    ORDER BY balance_cents DESC
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

function companyIdFromAsset(asset: string): string | null {
  return asset.startsWith('shares:') ? asset.slice('shares:'.length) : null;
}

function baselinePriceForTicker(ticker: string): number {
  let n = 0;
  for (let i = 0; i < ticker.length; i++) n += ticker.charCodeAt(i) * (i + 1);
  return 80 + (n % 160);
}
