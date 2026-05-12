'use client';
import { useEffect, useState } from 'react';
import PageChrome, { EmptyState, money, Panel, timeLabel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

interface Company {
  id: string;
  name: string;
  industry: string | null;
  ticker: string | null;
  treasury_cents: number;
  workers: number;
  payroll_cents: number;
  inventory_qty: number;
  shares_outstanding: number;
  last_price_cents: number | null;
  previous_price_cents: number | null;
  open_orders: number;
}

interface LedgerRow {
  id: number;
  t: string;
  reason: string;
  amount_cents: number;
  debit_kind: string;
  credit_kind: string;
}

interface OrderRow {
  id: string;
  t: string;
  kind: string;
  asset: string;
  price_cents: number;
  qty: number;
  filled_qty: number;
  status: string;
}

interface TradeRow {
  id: number;
  t: string;
  asset: string;
  price_cents: number;
  qty: number;
}

export default function MarketPage() {
  const [data, setData] = useState<{ companies: Company[]; recentLedger: LedgerRow[]; orders: OrderRow[]; trades: TradeRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<{ companies: Company[]; recentLedger: LedgerRow[]; orders: OrderRow[]; trades: TradeRow[] }>('/v1/market')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageChrome title="Market" eyebrow="companies, payroll, ledger flow">
      {error && <EmptyState>{error}</EmptyState>}
      {!data && !error && <EmptyState>Loading market...</EmptyState>}
      {data && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel className="overflow-hidden">
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Operating companies</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-2">Company</th>
                    <th className="px-4 py-2">Industry</th>
                    <th className="px-4 py-2 text-right">Ticker</th>
                    <th className="px-4 py-2 text-right">Last</th>
                    <th className="px-4 py-2 text-right">Orders</th>
                    <th className="px-4 py-2 text-right">Treasury</th>
                    <th className="px-4 py-2 text-right">Workers</th>
                    <th className="px-4 py-2 text-right">Inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companies.map((c) => (
                    <tr key={c.id} className="border-b border-white/5">
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2 text-zinc-400">{c.industry ?? 'unknown'}</td>
                      <td className="px-4 py-2 text-right font-mono">{c.ticker ?? '-'}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {c.last_price_cents ? (
                          <span className={toneForChange(c.last_price_cents, c.previous_price_cents)}>
                            {money(c.last_price_cents)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{c.open_orders}</td>
                      <td className="px-4 py-2 text-right font-mono">{money(c.treasury_cents)}</td>
                      <td className="px-4 py-2 text-right font-mono">{c.workers}</td>
                      <td className="px-4 py-2 text-right font-mono">{c.inventory_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel className="overflow-hidden">
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Open order book</h2>
            <div className="divide-y divide-white/5">
              {data.orders.slice(0, 14).map((row) => (
                <div key={row.id} className="px-4 py-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className={row.kind === 'buy' ? 'text-emerald-300' : 'text-amber-300'}>{row.kind.toUpperCase()} {row.asset}</span>
                    <span className="font-mono">{money(row.price_cents)} x {row.qty - row.filled_qty}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{row.status} · {timeLabel(row.t)}</div>
                </div>
              ))}
              {data.orders.length === 0 && <div className="px-4 py-6 text-sm text-zinc-500">No open orders yet.</div>}
            </div>
          </Panel>
          <Panel className="overflow-hidden lg:col-span-2">
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Market tape and money flow</h2>
            <div className="grid gap-0 lg:grid-cols-2">
              <div className="divide-y divide-white/5 border-white/10 lg:border-r">
                {data.trades.slice(0, 12).map((row) => (
                  <div key={row.id} className="px-4 py-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>{row.asset}</span>
                      <span className="font-mono">{money(row.price_cents)} x {row.qty}</span>
                    </div>
                    <div className="text-xs text-zinc-500">{timeLabel(row.t)}</div>
                  </div>
                ))}
                {data.trades.length === 0 && <div className="px-4 py-6 text-sm text-zinc-500">No trades cleared yet.</div>}
              </div>
              <div className="divide-y divide-white/5">
                {data.recentLedger.slice(0, 12).map((row) => (
                  <div key={row.id} className="px-4 py-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>{row.reason}</span>
                      <span className="font-mono">{money(row.amount_cents)}</span>
                    </div>
                    <div className="text-xs text-zinc-500">{row.debit_kind} to {row.credit_kind} · {timeLabel(row.t)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      )}
    </PageChrome>
  );
}

function toneForChange(last: number, previous: number | null): string {
  if (!previous || last === previous) return 'text-zinc-100';
  return last > previous ? 'text-emerald-300' : 'text-rose-300';
}
