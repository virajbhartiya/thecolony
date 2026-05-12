'use client';
import { useEffect, useState } from 'react';
import { useWorld } from '../lib/store';
import { fetchAgent } from '../lib/api';
import Portrait from './Portrait';

interface AgentDetail {
  agent: {
    id: string;
    name: string;
    age_years: number;
    balance_cents: number;
    status: string;
    state: string;
    occupation: string | null;
    needs: { hunger: number; energy: number; social: number; money_anxiety: number; life_satisfaction: number };
    traits: Record<string, number>;
    portrait_seed: string;
    pos_x: number;
    pos_y: number;
  };
  recentEvents: Array<{ id: number; t: string; kind: string; payload: Record<string, unknown> }>;
  memories: Array<{ id: number; t: string; kind: string; summary: string; salience: number }>;
  relationships: Array<{ subj_id: string; obj_id: string; affinity: number; trust: number; tags: string[] | null }>;
}

export default function AgentDrawer() {
  const id = useWorld((s) => s.selectedAgentId);
  const select = useWorld((s) => s.selectAgent);
  const follow = useWorld((s) => s.toggleFollow);
  const isFollow = useWorld((s) => s.followAgentId === id);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setDetail(null);
    setLoading(true);
    fetchAgent(id)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) return null;

  return (
    <div className="pointer-events-auto absolute right-4 top-4 bottom-4 z-20 w-[360px] glass rounded-lg flex flex-col">
      <header className="flex items-start gap-3 p-3 border-b border-white/5">
        {detail ? (
          <Portrait seed={detail.agent.portrait_seed} size={56} />
        ) : (
          <div className="w-14 h-14 bg-white/5 rounded-md animate-pulse" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium truncate">{detail?.agent.name ?? '…'}</h2>
          <p className="text-xs text-zinc-400">
            {detail ? `age ${detail.agent.age_years} · ${detail.agent.occupation ?? 'unemployed'}` : 'loading…'}
          </p>
          {detail && (
            <p className="text-xs text-zinc-400 mt-0.5">
              <span className="text-zinc-300 font-medium">${(detail.agent.balance_cents / 100).toFixed(0)}</span>
              {' '}· state: {detail.agent.state}
            </p>
          )}
        </div>
        <button
          onClick={() => select(null)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors px-2 py-1 text-sm"
          aria-label="Close"
        >
          ✕
        </button>
      </header>
      {detail && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
          <button
            onClick={() => follow(id)}
            className={`w-full rounded px-3 py-1.5 text-xs uppercase tracking-widest border ${
              isFollow
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'border-white/10 hover:bg-white/5'
            }`}
          >
            {isFollow ? 'Following · click to release' : 'Follow camera'}
          </button>

          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Needs</h3>
            <div className="space-y-1">
              <Bar label="hunger" value={detail.agent.needs.hunger} flip />
              <Bar label="energy" value={detail.agent.needs.energy} />
              <Bar label="social" value={detail.agent.needs.social} />
              <Bar label="life satisfaction" value={detail.agent.needs.life_satisfaction} />
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Traits</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-zinc-300 font-mono">
              {Object.entries(detail.agent.traits)
                .filter(([k]) => ['greed', 'risk', 'empathy', 'ambition', 'sociability', 'paranoia'].includes(k))
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-zinc-500">{k}</span>
                    <span>{Number(v).toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Recent events</h3>
            <div className="space-y-1 text-xs">
              {detail.recentEvents.length === 0 && <p className="text-zinc-500">No events yet.</p>}
              {detail.recentEvents.slice(0, 8).map((e) => (
                <div key={e.id} className="flex gap-2">
                  <span className="text-zinc-500 font-mono text-[10px] w-16 shrink-0">
                    {new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-zinc-300">{labelEvent(e.kind, e.payload)}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Memory</h3>
            <div className="space-y-1.5 text-xs">
              {detail.memories.length === 0 && <p className="text-zinc-500">No memories yet.</p>}
              {detail.memories.slice(0, 5).map((m) => (
                <p key={m.id} className="text-zinc-300 leading-snug">
                  <span className="text-zinc-500 italic">{m.summary}</span>
                </p>
              ))}
            </div>
          </section>
        </div>
      )}
      {loading && !detail && <div className="p-4 text-sm text-zinc-500">Loading…</div>}
    </div>
  );
}

function Bar({ label, value, flip }: { label: string; value: number; flip?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const good = flip ? 100 - pct : pct;
  const color = good > 60 ? '#7ee787' : good > 30 ? '#f0c84a' : '#f85149';
  return (
    <div>
      <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
        <span>{label}</span>
        <span className="font-mono">{pct.toFixed(0)}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function labelEvent(kind: string, payload: Record<string, unknown>): string {
  switch (kind) {
    case 'agent_spoke':
      return `spoke: "${String(payload.body ?? '').slice(0, 60)}"`;
    case 'agent_moved':
      return `moved to ${String(payload.to ?? '…')}`;
    case 'agent_ate':
      return `ate ${String(payload.qty ?? 1)} food`;
    case 'agent_slept':
      return `slept`;
    case 'agent_worked':
      return `worked`;
    case 'agent_paid_wage':
      return `received wage $${(Number(payload.amount_cents ?? 0) / 100).toFixed(0)}`;
    case 'agent_paid_rent':
      return `paid rent $${(Number(payload.rent ?? 0) / 100).toFixed(0)}`;
    case 'agent_evicted':
      return `evicted`;
    case 'agent_homed':
      return `moved in to ${String(payload.building ?? '…')}`;
    case 'agent_hired':
      return `hired at ${String(payload.company ?? '…')} as ${String(payload.role ?? 'worker')}`;
    case 'agent_died':
      return `died (${String(payload.cause ?? '…')})`;
    default:
      return kind;
  }
}
