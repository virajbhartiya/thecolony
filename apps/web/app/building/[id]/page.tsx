'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageChrome, { EmptyState, money, Panel, timeLabel } from '../../../components/PageChrome';
import { fetchEndpoint } from '../../../lib/api';

interface BuildingDetail {
  building: { id: string; name: string; kind: string; zone_kind: string; capacity: number; rent_cents: number; condition: number; tile_x: number; tile_y: number };
  company: { id: string; name: string; industry: string | null; treasury_cents: number; founder_id: string | null; charter: Record<string, unknown> } | null;
  occupants: Array<{ id: string; name: string; occupation: string | null; state: string; balance_cents: number }>;
  employees: Array<{ id: string; name: string; occupation: string | null; role: string; wage_cents: number }>;
  inventory: Array<{ key: string; qty: number }>;
  transactions: Array<{ id: number; t: string; reason: string; amount_cents: number; debit_kind: string; credit_kind: string }>;
}

export default function BuildingPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<BuildingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    fetchEndpoint<BuildingDetail>(`/v1/building/${params.id}`)
      .then(setDetail)
      .catch((e) => setError((e as Error).message));
  }, [params.id]);

  if (error) return <PageChrome title="Building"><EmptyState>{error}</EmptyState></PageChrome>;
  if (!detail) return <PageChrome title="Building"><EmptyState>Loading building dossier...</EmptyState></PageChrome>;

  const b = detail.building;
  return (
    <PageChrome title={b.name} eyebrow={`${b.kind} · ${b.zone_kind}`}>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel className="p-5">
          <h2 className="text-xl font-semibold">{b.name}</h2>
          <div className="mt-1 text-sm text-zinc-400">tile {b.tile_x}, {b.tile_y} · condition {b.condition}</div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Metric label="Capacity" value={String(b.capacity)} />
            <Metric label="Rent" value={b.rent_cents ? `${money(b.rent_cents)}/day` : '-'} />
            <Metric label="Company" value={detail.company?.name ?? 'none'} />
            <Metric label="Treasury" value={detail.company ? money(detail.company.treasury_cents) : '-'} />
          </div>
          {detail.company && (
            <p className="mt-4 rounded border border-white/10 bg-black/20 p-3 text-sm text-zinc-400">
              {(detail.company.charter?.mission as string | undefined) ?? 'No charter text.'}
            </p>
          )}
        </Panel>

        <div className="grid gap-4">
          <Panel className="overflow-hidden">
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Employees</h2>
            <div className="divide-y divide-white/5">
              {detail.employees.length === 0 && <div className="p-4 text-sm text-zinc-500">No employees.</div>}
              {detail.employees.map((e) => (
                <Link key={e.id} href={`/agent/${e.id}`} className="flex justify-between gap-4 px-4 py-2 text-sm hover:bg-white/[0.04]">
                  <span>{e.name}<span className="block text-xs text-zinc-500">{e.occupation ?? e.role}</span></span>
                  <span className="font-mono text-xs">{money(e.wage_cents)}/day</span>
                </Link>
              ))}
            </div>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="p-4">
              <h2 className="text-sm font-semibold">Occupants now</h2>
              <div className="mt-3 space-y-2">
                {detail.occupants.length === 0 && <p className="text-sm text-zinc-500">Empty.</p>}
                {detail.occupants.map((o) => (
                  <Link key={o.id} href={`/agent/${o.id}`} className="block rounded border border-white/5 px-3 py-2 text-sm hover:bg-white/[0.04]">
                    {o.name}<span className="block text-xs text-zinc-500">{o.occupation ?? 'unassigned'} · {o.state}</span>
                  </Link>
                ))}
              </div>
            </Panel>
            <Panel className="p-4">
              <h2 className="text-sm font-semibold">Inventory and transactions</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.inventory.map((i) => <span key={i.key} className="rounded border border-white/10 px-2 py-1 text-xs">{i.key} {i.qty}</span>)}
                {detail.inventory.length === 0 && <span className="text-sm text-zinc-500">No inventory.</span>}
              </div>
              <div className="mt-4 space-y-2">
                {detail.transactions.slice(0, 8).map((t) => (
                  <div key={t.id} className="border-t border-white/10 pt-2 text-xs text-zinc-400">
                    {t.reason} · {money(t.amount_cents)} · {timeLabel(t.t)}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </PageChrome>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="truncate text-sm text-zinc-100">{value}</div>
    </div>
  );
}
