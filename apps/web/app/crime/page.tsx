'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, Panel, timeLabel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

interface Incident {
  id: string;
  t: string;
  kind: string;
  perp_id: string | null;
  victim_id: string | null;
  severity: number;
  resolved: boolean;
}

interface Criminal {
  id: string;
  name: string;
  occupation: string | null;
  incidents: number;
  severity: number;
}

export default function CrimePage() {
  const [data, setData] = useState<{ incidents: Incident[]; topCriminals: Criminal[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<{ incidents: Incident[]; topCriminals: Criminal[] }>('/v1/crime')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageChrome title="Crime Desk" eyebrow="incidents, suspects, severity">
      {error && <EmptyState>{error}</EmptyState>}
      {!data && !error && <EmptyState>Loading crime records...</EmptyState>}
      {data && (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
          <Panel className="overflow-hidden">
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Top offenders</h2>
            <div className="divide-y divide-white/5">
              {data.topCriminals.length === 0 && <div className="p-4 text-sm text-zinc-500">No crimes recorded yet.</div>}
              {data.topCriminals.map((c, i) => (
                <Link key={c.id} href={`/agent/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-white/[0.04]">
                  <span>
                    <span className="mr-2 text-xs text-zinc-500">{i + 1}</span>
                    {c.name}
                    <span className="block text-xs text-zinc-500">{c.occupation ?? 'unassigned'}</span>
                  </span>
                  <span className="text-right font-mono text-xs">{c.severity}<span className="block text-zinc-500">{c.incidents} cases</span></span>
                </Link>
              ))}
            </div>
          </Panel>
          <Panel className="overflow-hidden">
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Incident feed</h2>
            <div className="divide-y divide-white/5">
              {data.incidents.length === 0 && <div className="p-4 text-sm text-zinc-500">No incidents recorded yet.</div>}
              {data.incidents.map((i) => (
                <div key={i.id} className="px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="font-medium">{i.kind}</span>
                    <span className={i.resolved ? 'text-emerald-300' : 'text-amber-300'}>{i.resolved ? 'resolved' : 'open'}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">severity {i.severity} · {timeLabel(i.t)}</div>
                  <div className="mt-1 flex gap-3 text-xs">
                    {i.perp_id && <Link className="text-sky-300" href={`/agent/${i.perp_id}`}>perp</Link>}
                    {i.victim_id && <Link className="text-sky-300" href={`/agent/${i.victim_id}`}>victim</Link>}
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
