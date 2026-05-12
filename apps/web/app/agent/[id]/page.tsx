'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageChrome, { EmptyState, money, Panel, timeLabel } from '../../../components/PageChrome';
import Portrait from '../../../components/Portrait';
import { eventText } from '../../../components/EventText';
import { fetchAgent } from '../../../lib/api';

interface AgentDetail {
  agent: {
    id: string;
    name: string;
    age_years: number;
    balance_cents: number;
    status: string;
    state: string;
    occupation: string | null;
    needs: Record<string, number>;
    traits: Record<string, number>;
    portrait_seed: string;
    home_id: string | null;
    employer_id: string | null;
  };
  employer: { id: string; name: string; industry: string | null; treasury_cents: number } | null;
  home: { id: string; name: string; kind: string; rent_cents: number } | null;
  inventory: Array<{ key: string; qty: number }>;
  votes: Array<{ election_id: string; reason: string; t: string }>;
  recentEvents: Array<{ id: number; t: string; kind: string; payload: Record<string, unknown> }>;
  memories: Array<{ id: number; t: string; kind: string; summary: string; salience: number }>;
  relationships: Array<{ obj_id: string; affinity: number; trust: number; tags: string[] | null }>;
}

export default function AgentPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    fetchAgent(params.id)
      .then(setDetail)
      .catch((e) => setError((e as Error).message));
  }, [params.id]);

  if (error) return <PageChrome title="Agent"><EmptyState>{error}</EmptyState></PageChrome>;
  if (!detail) return <PageChrome title="Agent"><EmptyState>Loading agent dossier...</EmptyState></PageChrome>;

  const a = detail.agent;
  return (
    <PageChrome title={a.name} eyebrow={`${a.occupation ?? 'unassigned'} · ${a.status}`}>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel className="p-5">
          <div className="flex items-start gap-4">
            <Portrait seed={a.portrait_seed} size={96} />
            <div>
              <h2 className="text-xl font-semibold">{a.name}</h2>
              <div className="mt-1 text-sm text-zinc-400">age {a.age_years} · {a.state}</div>
              <div className="mt-2 font-mono text-lg">{money(a.balance_cents)}</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Employer" value={detail.employer?.name ?? 'none'} />
            <Metric label="Home" value={detail.home?.name ?? 'homeless'} href={detail.home ? `/building/${detail.home.id}` : undefined} />
            <Metric label="Rent" value={detail.home ? money(detail.home.rent_cents) : '-'} />
            <Metric label="Status" value={a.status} />
          </div>
          <h3 className="mt-5 text-xs uppercase text-zinc-500">Needs</h3>
          <div className="mt-2 space-y-2">
            {Object.entries(a.needs).map(([k, v]) => <Bar key={k} label={k} value={Number(v)} />)}
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel className="p-4">
            <h2 className="text-sm font-semibold">Traits and inventory</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {Object.entries(a.traits)
                .filter(([k]) => ['greed', 'risk', 'empathy', 'ambition', 'sociability', 'paranoia', 'ideology_lean'].includes(k))
                .map(([k, v]) => <Metric key={k} label={k} value={Number(v).toFixed(2)} />)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.inventory.map((item) => (
                <span key={item.key} className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-xs">
                  {item.key} {item.qty}
                </span>
              ))}
              {detail.inventory.length === 0 && <span className="text-sm text-zinc-500">No inventory.</span>}
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="p-4">
              <h2 className="text-sm font-semibold">Memory</h2>
              <div className="mt-3 space-y-3">
                {detail.memories.length === 0 && <p className="text-sm text-zinc-500">No memories yet.</p>}
                {detail.memories.map((m) => (
                  <div key={m.id} className="border-t border-white/10 pt-3 text-sm text-zinc-400">
                    <div className="text-xs uppercase text-zinc-600">{m.kind} · salience {m.salience.toFixed(2)}</div>
                    {m.summary}
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="p-4">
              <h2 className="text-sm font-semibold">Recent events</h2>
              <div className="mt-3 space-y-3">
                {detail.recentEvents.map((e) => (
                  <div key={e.id} className="border-t border-white/10 pt-3 text-sm">
                    <div className="text-xs uppercase text-zinc-600">{e.kind} · {timeLabel(e.t)}</div>
                    <div className="text-zinc-300">{eventText(e.kind, e.payload)}</div>
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

function Metric({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <div className="rounded border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="truncate text-sm text-zinc-100">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-500"><span>{label}</span><span>{pct.toFixed(0)}</span></div>
      <div className="h-2 rounded bg-white/10"><div className="h-2 rounded bg-sky-400" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
