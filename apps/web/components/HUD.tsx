'use client';
import Link from 'next/link';
import { useWorld } from '../lib/store';

export default function HUD() {
  const population = useWorld((s) => s.population);
  const gdp = useWorld((s) => s.gdp_cents);
  const government = useWorld((s) => s.government);
  const connected = useWorld((s) => s.connected);
  const events = useWorld((s) => s.events);
  const agents = useWorld((s) => s.agents);
  const recentCrime = events.filter((e) => e.kind.startsWith('incident_')).length;
  const recentDeaths = events.filter((e) => e.kind === 'agent_died').length;
  const professionMix = topProfessions(Array.from(agents.values()));

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute left-4 top-4 w-[min(980px,calc(100vw-24rem))] max-w-[980px]">
        <div className="glass-strong rounded-lg p-3 shadow-2xl">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="live-dot" />
                <span className="text-[10px] uppercase text-zinc-400">
                  {connected ? 'live shared city' : 'reconnecting'}
                </span>
              </div>
              <h1 className="mt-1 text-lg font-semibold text-zinc-50">TheColony civic console</h1>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="population" value={population.toLocaleString()} />
              <Stat label="GDP" value={`$${(gdp / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <Stat label="crime" value={recentCrime.toString()} tone={recentCrime > 0 ? 'warn' : 'neutral'} />
              <Stat label="deaths" value={recentDeaths.toString()} tone={recentDeaths > 0 ? 'danger' : 'neutral'} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[1.15fr_1fr_1.1fr] gap-2">
            <InfoBlock
              label="mayor"
              primary={government.mayor_name ?? 'unseated'}
              secondary={`tax ${(government.tax_rate_bps / 100).toFixed(1)}% · treasury $${(government.treasury_cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
            <InfoBlock
              label="next election"
              primary={government.next_election_at ? timeDistance(government.next_election_at) : 'pending'}
              secondary={government.turnout ? `${government.turnout} voters last term` : 'founding term'}
            />
            <div className="rounded border border-white/10 bg-black/20 px-3 py-2">
              <div className="text-[10px] uppercase text-zinc-500">workforce</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {professionMix.map((p) => (
                  <span key={p.name} className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-200">
                    {p.name} <span className="text-zinc-500">{p.count}</span>
                  </span>
                ))}
                {professionMix.length === 0 && <span className="text-xs text-zinc-500">waiting for snapshot</span>}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {HUD_LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/20 hover:bg-white/[0.07]"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, primary, secondary }: { label: string; primary: string; secondary: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 px-3 py-2 min-w-0">
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium text-zinc-100">{primary}</div>
      <div className="truncate text-[11px] text-zinc-400">{secondary}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'warn' | 'danger';
}) {
  const color = tone === 'warn' ? 'text-amber-400' : tone === 'danger' ? 'text-rose-400' : 'text-zinc-100';
  return (
    <div className="rounded border border-white/10 bg-white/[0.035] px-3 py-2 min-w-[92px]">
      <span className="text-[10px] uppercase text-zinc-500">{label}</span>
      <span className={`block text-sm font-mono font-medium ${color}`}>{value}</span>
    </div>
  );
}

const HUD_LINKS = [
  ['/feed', 'Feed'],
  ['/news', 'News'],
  ['/leaderboards', 'Leaders'],
  ['/market', 'Market'],
  ['/crime', 'Crime'],
  ['/history', 'History'],
] as const;

function topProfessions(agents: Array<{ occupation: string | null }>): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const agent of agents) {
    const name = agent.occupation ?? 'unassigned';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);
}

function timeDistance(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return 'pending';
  if (ms <= 0) return 'now';
  const minutes = Math.ceil(ms / 60000);
  return `${minutes} min`;
}
