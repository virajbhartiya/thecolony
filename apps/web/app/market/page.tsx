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
  price_points: Array<number | string>;
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
                    <th className="px-4 py-2 text-right">Trend</th>
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
                      <td className="px-4 py-2">
                        <Sparkline points={c.price_points.map(Number)} tone={toneForChange(c.last_price_cents ?? 0, c.previous_price_cents)} />
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
          <div className="grid gap-4">
            <Panel className="overflow-hidden">
              <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Top movers</h2>
              <div className="divide-y divide-white/5">
                {topMovers(data.companies).map((company) => (
                  <div key={company.id} className="px-4 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{company.ticker ?? company.name}</span>
                      <span className={`font-mono ${toneForChange(company.last_price_cents ?? 0, company.previous_price_cents)}`}>
                        {changeLabel(company)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <Sparkline points={company.price_points.map(Number)} tone={toneForChange(company.last_price_cents ?? 0, company.previous_price_cents)} />
                    </div>
                  </div>
                ))}
                {topMovers(data.companies).length === 0 && <div className="px-4 py-6 text-sm text-zinc-500">No price movement yet.</div>}
              </div>
            </Panel>
            <Panel className="overflow-hidden">
              <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Open order book</h2>
              <div className="divide-y divide-white/5">
                {data.orders.slice(0, 10).map((row) => (
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
          </div>
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

function topMovers(companies: Company[]): Company[] {
  return companies
    .filter((company) => company.last_price_cents && company.previous_price_cents)
    .sort((a, b) => Math.abs(changePct(b)) - Math.abs(changePct(a)))
    .slice(0, 5);
}

function changePct(company: Company): number {
  if (!company.last_price_cents || !company.previous_price_cents) return 0;
  return (company.last_price_cents - company.previous_price_cents) / company.previous_price_cents;
}

function changeLabel(company: Company): string {
  const pct = changePct(company);
  if (!pct) return 'flat';
  return `${pct > 0 ? '+' : ''}${(pct * 100).toFixed(1)}%`;
}

function Sparkline({ points, tone }: { points: number[]; tone: string }) {
  const clean = points.filter((point) => Number.isFinite(point));
  if (clean.length < 2) return <div className="h-7 text-right text-xs text-zinc-600">flat</div>;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = Math.max(1, max - min);
  const coords = clean
    .map((point, index) => {
      const x = (index / Math.max(1, clean.length - 1)) * 96;
      const y = 26 - ((point - min) / span) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke = tone.includes('emerald') ? '#7ee787' : tone.includes('rose') ? '#fb7185' : '#a1a1aa';
  return (
    <svg viewBox="0 0 96 28" className="ml-auto h-7 w-24" aria-hidden="true">
      <polyline points={coords} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
