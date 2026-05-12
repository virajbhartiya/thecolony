'use client';
import { useEffect, useState } from 'react';
import PageChrome, { EmptyState, money, Panel, timeLabel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

interface Company {
  id: string;
  name: string;
  industry: string | null;
  treasury_cents: number;
  workers: number;
  payroll_cents: number;
  inventory_qty: number;
}

interface LedgerRow {
  id: number;
  t: string;
  reason: string;
  amount_cents: number;
  debit_kind: string;
  credit_kind: string;
}

export default function MarketPage() {
  const [data, setData] = useState<{ companies: Company[]; recentLedger: LedgerRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<{ companies: Company[]; recentLedger: LedgerRow[] }>('/v1/market')
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
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Recent money flow</h2>
            <div className="divide-y divide-white/5">
              {data.recentLedger.slice(0, 20).map((row) => (
                <div key={row.id} className="px-4 py-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{row.reason}</span>
                    <span className="font-mono">{money(row.amount_cents)}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{row.debit_kind} to {row.credit_kind} · {timeLabel(row.t)}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </PageChrome>
  );
}
