'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, money, Panel, timeLabel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

interface Incident {
  id: string;
  t: string;
  kind: string;
  perp_id: string | null;
  victim_id: string | null;
  severity: number;
  resolved: boolean;
  perp_name: string | null;
  victim_name: string | null;
  amount_cents: number;
  location_id: string | null;
  location_name: string | null;
}

interface Criminal {
  id: string;
  name: string;
  occupation: string | null;
  status: string;
  incidents: number;
  severity: number;
  warrants: number;
  bounty_cents: number;
  jail_until: string | null;
}

interface LegalRow {
  agent_id: string;
  name: string;
  occupation: string | null;
  status: string;
  warrants: number;
  debts_cents: number;
  bounty_cents: number;
  jail_until: string | null;
  parole_until: string | null;
}

interface HeatmapRow {
  location_id: string;
  name: string;
  kind: string;
  incidents: number;
  severity: number;
}

export default function CrimePage() {
  const [data, setData] = useState<{ incidents: Incident[]; topCriminals: Criminal[]; legal: LegalRow[]; heatmap: HeatmapRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<{ incidents: Incident[]; topCriminals: Criminal[]; legal: LegalRow[]; heatmap: HeatmapRow[] }>('/v1/crime')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageChrome title="Crime Desk" eyebrow="incidents, suspects, severity">
      {error && <EmptyState>{error}</EmptyState>}
      {!data && !error && <EmptyState>Loading crime records...</EmptyState>}
      {data && (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
          <div className="grid gap-4">
            <Panel className="overflow-hidden">
              <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Top offenders</h2>
              <div className="divide-y divide-white/5">
                {data.topCriminals.length === 0 && <div className="p-4 text-sm text-zinc-500">No crimes recorded yet.</div>}
                {data.topCriminals.map((c, i) => (
                  <Link key={c.id} href={`/agent/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-white/[0.04]">
                    <span className="min-w-0">
                      <span className="mr-2 text-xs text-zinc-500">{i + 1}</span>
                      {c.name}
                      <span className="block truncate text-xs text-zinc-500">{c.occupation ?? 'unassigned'} · {c.status}</span>
                    </span>
                    <span className="text-right font-mono text-xs">
                      {c.severity}
                      <span className="block text-zinc-500">{c.incidents} cases</span>
                      {c.warrants > 0 && <span className="block text-amber-300">{c.warrants} warrants</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Hot buildings</h2>
              <div className="divide-y divide-white/5">
                {data.heatmap.length === 0 && <div className="p-4 text-sm text-zinc-500">No crime locations yet.</div>}
                {data.heatmap.map((row) => (
                  <Link key={row.location_id} href={`/building/${row.location_id}`} className="block px-4 py-3 text-sm hover:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{row.name}</span>
                      <span className="font-mono text-rose-300">{row.severity}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{row.kind} · {row.incidents} incident(s)</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full bg-rose-400" style={{ width: `${Math.min(100, row.severity * 12)}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Legal status</h2>
              <div className="divide-y divide-white/5">
                {data.legal.length === 0 && <div className="p-4 text-sm text-zinc-500">No active warrants, debts, or jail records.</div>}
                {data.legal.map((row) => (
                  <Link key={row.agent_id} href={`/agent/${row.agent_id}`} className="block px-4 py-3 text-sm hover:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{row.name}</span>
                      <span className={row.status === 'jailed' ? 'text-rose-300' : 'text-amber-300'}>{row.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{row.occupation ?? 'unassigned'}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <MiniStat label="warrants" value={String(row.warrants)} />
                      <MiniStat label="bounty" value={money(row.bounty_cents)} />
                      <MiniStat label="debt" value={money(row.debts_cents)} />
                    </div>
                    {row.jail_until && <div className="mt-2 text-xs text-rose-300">jailed until {timeLabel(row.jail_until)}</div>}
                  </Link>
                ))}
              </div>
            </Panel>
          </div>

          <Panel className="overflow-hidden">
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Incident feed</h2>
            <div className="divide-y divide-white/5">
              {data.incidents.length === 0 && <div className="p-4 text-sm text-zinc-500">No incidents recorded yet.</div>}
              {data.incidents.map((i) => (
                <div key={i.id} className="px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="font-medium capitalize">{i.kind.replaceAll('_', ' ')}</span>
                    <span className={i.resolved ? 'text-emerald-300' : 'text-amber-300'}>{i.resolved ? 'resolved' : 'open'}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    severity {i.severity} · {timeLabel(i.t)}
                    {i.amount_cents > 0 ? ` · ${money(i.amount_cents)}` : ''}
                    {i.location_id ? ' · ' : ''}
                    {i.location_id && (
                      <Link className="text-sky-300" href={`/building/${i.location_id}`}>
                        {i.location_name ?? 'location'}
                      </Link>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <PersonLink label="accused" id={i.perp_id} name={i.perp_name} />
                    <PersonLink label="victim" id={i.victim_id} name={i.victim_name} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </PageChrome>
  );
}

function PersonLink({ label, id, name }: { label: string; id: string | null; name: string | null }) {
  return (
    <div className="rounded border border-white/5 bg-black/20 px-3 py-2 text-xs">
      <div className="uppercase text-zinc-500">{label}</div>
      {id ? (
        <Link href={`/agent/${id}`} className="mt-0.5 block truncate text-sky-300 hover:text-sky-200">
          {name ?? id.slice(0, 8)}
        </Link>
      ) : (
        <div className="mt-0.5 text-zinc-500">unknown</div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/5 bg-black/20 px-2 py-1">
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="font-mono text-zinc-200">{value}</div>
    </div>
  );
}
