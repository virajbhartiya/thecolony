'use client';
import { useWorld } from '../lib/store';

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  agent_died: { label: '✝ died', tone: 'text-rose-400' },
  agent_evicted: { label: '↯ evicted', tone: 'text-amber-400' },
  agent_homed: { label: '⌂ moved in', tone: 'text-emerald-400' },
  agent_hired: { label: '+ hired', tone: 'text-emerald-400' },
  agent_fired: { label: '− fired', tone: 'text-rose-300' },
  agent_paid_wage: { label: '$ paid', tone: 'text-emerald-300' },
  agent_paid_rent: { label: '$ rent', tone: 'text-amber-300' },
  agent_spoke: { label: '" spoke', tone: 'text-zinc-300' },
  agent_ate: { label: '🍽 ate', tone: 'text-zinc-400' },
  agent_slept: { label: '☾ slept', tone: 'text-zinc-500' },
  agent_moved: { label: '→ moved', tone: 'text-zinc-500' },
  agent_worked: { label: '⚒ worked', tone: 'text-zinc-400' },
  company_founded: { label: '✦ company', tone: 'text-cyan-400' },
  agent_spawned: { label: '✦ born', tone: 'text-emerald-400' },
  migrant_arrived: { label: '✦ migrant', tone: 'text-emerald-300' },
  incident_theft: { label: '⚠ theft', tone: 'text-rose-400' },
  incident_assault: { label: '⚠ assault', tone: 'text-rose-500' },
};

export default function EventTicker() {
  const events = useWorld((s) => s.events);
  const agents = useWorld((s) => s.agents);
  const select = useWorld((s) => s.selectAgent);

  const visible = events.filter((e) => (KIND_LABEL[e.kind]?.label) && e.importance >= 1).slice(0, 60);

  return (
    <div className="pointer-events-auto absolute right-4 top-20 bottom-4 w-80 glass rounded-lg flex flex-col">
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-zinc-400">live ticker</span>
        <span className="text-[10px] text-zinc-500">{visible.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {visible.length === 0 && (
          <div className="text-xs text-zinc-500 px-2 py-4">No events yet. The city is waking up.</div>
        )}
        {visible.map((e) => {
          const meta = KIND_LABEL[e.kind] ?? { label: e.kind, tone: 'text-zinc-400' };
          const actor = agents.get(e.actor_ids[0] ?? '');
          const detail = describeEvent(e);
          return (
            <button
              key={e.id}
              onClick={() => actor && select(actor.id)}
              className="w-full text-left flex items-start gap-2 rounded px-2 py-1.5 hover:bg-white/5 transition-colors"
            >
              <span className={`text-[10px] uppercase tracking-wider w-16 shrink-0 mt-0.5 ${meta.tone}`}>
                {meta.label}
              </span>
              <span className="text-xs leading-snug text-zinc-200">
                <span className="font-medium">{actor?.name ?? 'unknown'}</span>
                {detail && <span className="text-zinc-400"> — {detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function describeEvent(e: { kind: string; payload: Record<string, unknown> }): string {
  const p = e.payload ?? {};
  switch (e.kind) {
    case 'agent_spoke':
      return `"${String(p.body ?? '').slice(0, 80)}"`;
    case 'agent_died':
      return `cause: ${String(p.cause ?? 'unknown')}`;
    case 'agent_paid_wage':
      return `+$${(Number(p.amount_cents ?? 0) / 100).toFixed(0)}`;
    case 'agent_paid_rent':
      return `-$${(Number(p.rent ?? 0) / 100).toFixed(0)}`;
    case 'agent_hired':
      return `as ${String(p.role ?? 'worker')} @ ${String(p.company ?? 'a company')}`;
    case 'agent_moved':
      return `to ${String(p.to ?? '...')}`;
    case 'agent_homed':
      return `at ${String(p.building ?? '...')}`;
    default:
      return '';
  }
}
