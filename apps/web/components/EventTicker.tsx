'use client';
import { useWorld } from '../lib/store';

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  agent_died: { label: 'death', tone: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  agent_bankrupt: { label: 'bankrupt', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  agent_evicted: { label: 'evicted', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  agent_homed: { label: 'housing', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  agent_hired: { label: 'hired', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  agent_fired: { label: 'fired', tone: 'text-rose-300 border-rose-500/30 bg-rose-500/10' },
  agent_paid_wage: { label: 'wage', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  agent_paid_rent: { label: 'rent', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  agent_paid_tax: { label: 'tax', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10' },
  agent_spoke: { label: 'speech', tone: 'text-zinc-300 border-zinc-500/30 bg-white/[0.04]' },
  agent_ate: { label: 'food', tone: 'text-zinc-300 border-zinc-500/30 bg-white/[0.04]' },
  agent_slept: { label: 'sleep', tone: 'text-zinc-400 border-zinc-600/30 bg-white/[0.03]' },
  agent_moved: { label: 'move', tone: 'text-zinc-500 border-zinc-700/30 bg-white/[0.02]' },
  agent_worked: { label: 'work', tone: 'text-zinc-300 border-zinc-500/30 bg-white/[0.04]' },
  job_posted: { label: 'jobs', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10' },
  company_founded: { label: 'company', tone: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' },
  shares_issued: { label: 'shares', tone: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' },
  order_placed: { label: 'order', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  trade_executed: { label: 'trade', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  agent_spawned: { label: 'born', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  migrant_arrived: { label: 'migrant', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  birth: { label: 'birth', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  incident_theft: { label: 'theft', tone: 'text-rose-300 border-rose-500/30 bg-rose-500/10' },
  incident_assault: { label: 'assault', tone: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  incident_fraud: { label: 'fraud', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  incident_breach: { label: 'breach', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  incident_witnessed: { label: 'witness', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10' },
  agent_accused: { label: 'accused', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  court_verdict: { label: 'court', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10' },
  bounty_paid: { label: 'bounty', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  agent_jailed: { label: 'jailed', tone: 'text-rose-300 border-rose-500/30 bg-rose-500/10' },
  agent_released: { label: 'released', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  group_founded: { label: 'group', tone: 'text-violet-300 border-violet-500/30 bg-violet-500/10' },
  group_joined: { label: 'joined', tone: 'text-violet-300 border-violet-500/30 bg-violet-500/10' },
  group_left: { label: 'left', tone: 'text-zinc-300 border-zinc-500/30 bg-white/[0.04]' },
  city_founded: { label: 'civic', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10' },
  city_tax_collected: { label: 'taxes', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10' },
  city_aid_paid: { label: 'aid', tone: 'text-blue-300 border-blue-500/30 bg-blue-500/10' },
  vote_cast: { label: 'vote', tone: 'text-violet-300 border-violet-500/30 bg-violet-500/10' },
  mayor_elected: { label: 'mayor', tone: 'text-violet-300 border-violet-500/30 bg-violet-500/10' },
};

export default function EventTicker() {
  const events = useWorld((s) => s.events);
  const agents = useWorld((s) => s.agents);
  const select = useWorld((s) => s.selectAgent);

  const visible = events.filter((e) => (KIND_LABEL[e.kind]?.label) && e.importance >= 1).slice(0, 60);

  return (
    <div className="pointer-events-auto absolute right-4 top-4 bottom-4 w-[340px] glass-strong rounded-lg flex flex-col shadow-2xl">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs uppercase text-zinc-300">city record</span>
        <span className="text-[10px] text-zinc-500">{visible.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {visible.length === 0 && (
          <div className="text-xs text-zinc-500 px-2 py-4">No events yet. The city is waking up.</div>
        )}
        {visible.map((e) => {
          const meta = KIND_LABEL[e.kind] ?? { label: e.kind, tone: 'text-zinc-400' };
          const actor = agents.get(e.actor_ids[0] ?? '');
          const actorName = civicActor(e.kind) !== 'unknown' ? civicActor(e.kind) : actor?.name ?? 'unknown';
          const detail = describeEvent(e);
          return (
            <button
              key={e.id}
              onClick={() => actor && select(actor.id)}
              className="w-full text-left rounded-md border border-white/[0.045] bg-black/15 px-2 py-2 hover:bg-white/[0.055] transition-colors"
            >
              <span className="flex items-start gap-2">
                <span className={`text-[10px] uppercase rounded border px-1.5 py-0.5 shrink-0 ${meta.tone}`}>
                  {meta.label}
                </span>
                <span className="text-xs leading-snug text-zinc-200 min-w-0">
                <span className="font-medium">{actorName}</span>
                {detail && <span className="text-zinc-400"> - {detail}</span>}
                </span>
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
    case 'agent_bankrupt':
      return `debts exceeded survival cash`;
    case 'birth':
      return `${String(p.name ?? 'new citizen')}`;
    case 'agent_paid_wage':
      return `+$${(Number(p.amount_cents ?? 0) / 100).toFixed(0)}`;
    case 'agent_paid_rent':
      return `-$${(Number(p.rent ?? 0) / 100).toFixed(0)}`;
    case 'city_tax_collected':
      return `$${(Number(p.amount_cents ?? 0) / 100).toFixed(0)} from ${String(p.taxpayer_count ?? 0)} taxpayers`;
    case 'city_aid_paid':
      return `$${(Number(p.amount_cents ?? 0) / 100).toFixed(0)} for ${String(p.reason ?? 'aid')}`;
    case 'vote_cast':
      return `voted for ${String(p.candidate ?? 'candidate')} on ${String(p.reason ?? 'policy')}`;
    case 'mayor_elected':
      return `${String(p.mayor_name ?? 'unknown')} won ${String(p.votes ?? '?')} votes`;
    case 'city_founded':
      return `mayor ${String(p.mayor_name ?? 'unseated')}, tax ${(Number(p.tax_rate_bps ?? 0) / 100).toFixed(1)}%`;
    case 'agent_hired':
      return `as ${String(p.role ?? 'worker')} at ${String(p.company ?? 'a company')}`;
    case 'agent_fired':
      return `${String(p.role ?? 'worker')} from ${String(p.company ?? 'a company')}`;
    case 'job_posted':
      return `${String(p.company ?? 'company')} needs ${String(p.openings ?? '?')} ${String(p.role ?? 'worker')}`;
    case 'company_founded':
      return `${String(p.name ?? 'company')} by ${String(p.founder ?? 'founder')}`;
    case 'shares_issued':
      return `${String(p.ticker ?? p.company ?? 'company')} ${String(p.shares ?? '?')} shares`;
    case 'order_placed':
      return `${String(p.side ?? 'order')} ${String(p.ticker ?? p.asset ?? 'shares')} $${(Number(p.price_cents ?? 0) / 100).toFixed(2)} x ${String(p.qty ?? '?')}`;
    case 'trade_executed':
      return `${String(p.ticker ?? p.asset ?? 'shares')} $${(Number(p.price_cents ?? 0) / 100).toFixed(2)} x ${String(p.qty ?? '?')}`;
    case 'incident_theft':
      return `$${(Number(p.amount_cents ?? 0) / 100).toFixed(0)} stolen`;
    case 'incident_assault':
      return `severity ${String(p.severity ?? '?')}`;
    case 'incident_fraud':
      return `$${(Number(p.amount_cents ?? 0) / 100).toFixed(0)} fraud`;
    case 'incident_breach':
      return `$${(Number(p.amount_cents ?? 0) / 100).toFixed(0)} breach`;
    case 'incident_witnessed':
      return `${String(p.charge ?? 'case')} reported nearby`;
    case 'agent_accused':
      return `charged with ${String(p.charge ?? 'case')}`;
    case 'court_verdict':
      return `${p.guilty ? 'guilty' : 'not guilty'} on ${String(p.charge ?? 'case')}`;
    case 'bounty_paid':
      return `$${(Number(p.amount_cents ?? 0) / 100).toFixed(0)} for the arrest`;
    case 'agent_jailed':
      return `${String(p.charge ?? 'case')} until ${p.jail_until ? new Date(String(p.jail_until)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'release'}`;
    case 'agent_released':
      return `parole until ${p.parole_until ? new Date(String(p.parole_until)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'later'}`;
    case 'group_founded':
      return `${String(p.name ?? 'group')} (${String(p.kind ?? 'faction')})`;
    case 'group_joined':
      return `${String(p.name ?? 'group')}`;
    case 'group_left':
      return `${String(p.name ?? 'group')}`;
    case 'agent_moved':
      return `to ${String(p.to ?? '...')}`;
    case 'agent_homed':
      return `at ${String(p.building ?? '...')}`;
    default:
      return '';
  }
}

function civicActor(kind: string): string {
  return kind.startsWith('city_') || kind === 'mayor_elected' ? 'City Hall' : 'unknown';
}
