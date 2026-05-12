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
      <div className="pointer-events-auto absolute left-3 right-3 top-3 lg:left-4 lg:right-[23rem] lg:max-w-[980px]">
        <div className="panel min-w-0 overflow-hidden">
          <div className="grid min-h-14 grid-cols-1 border-b border-[var(--line-soft)] lg:grid-cols-[auto_1fr]">
            <div className="flex min-w-0 items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 lg:border-b-0 lg:border-r">
              <div className="grid h-8 w-8 place-items-center border border-[var(--amber)] bg-[var(--ink-0)] text-[var(--amber-2)]">
                <span className="text-sm font-bold">TC</span>
              </div>
              <div className="min-w-0">
                <h1 className="panel-title truncate">TheColony</h1>
                <div className="mt-0.5 flex items-center gap-2">
                <span className="live-dot" />
                  <span className="panel-tag">
                  {connected ? 'live shared city' : 'reconnecting'}
                </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <Stat label="population" value={population.toLocaleString()} />
              <Stat label="GDP" value={`$${(gdp / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <Stat label="crime" value={recentCrime.toString()} tone={recentCrime > 0 ? 'warn' : 'neutral'} />
              <Stat label="deaths" value={recentDeaths.toString()} tone={recentDeaths > 0 ? 'danger' : 'neutral'} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px bg-[var(--line-soft)] md:grid-cols-[1.15fr_1fr_1.1fr]">
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
            <div className="bg-[var(--ink-1)] px-3 py-2">
              <div className="metric-label">workforce</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {professionMix.map((p) => (
                  <span key={p.name} className="hud-chip border border-[var(--line)] bg-[var(--ink-2)] px-1.5 py-0.5 text-[10px] text-[var(--cream-dim)] sm:px-2 sm:text-[11px]">
                    {p.name} <span className="text-[var(--mute)]">{p.count}</span>
                  </span>
                ))}
                {professionMix.length === 0 && <span className="text-xs text-zinc-500">waiting for snapshot</span>}
              </div>
            </div>
          </div>
          <div className="hud-nav flex flex-wrap gap-px border-t border-[var(--line-soft)] bg-[var(--ink-0)]">
            {HUD_LINKS.map(([href, label], index) => (
              <Link
                key={href}
                href={href}
                className={`${index > 5 ? 'hidden sm:inline-block' : ''} px-2 py-2 text-[10px] uppercase tracking-wide text-[var(--cream-dim)] hover:bg-[var(--ink-3)] hover:text-[var(--amber-2)] sm:px-3 sm:text-[11px]`}
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
    <div className="min-w-0 bg-[var(--ink-1)] px-3 py-2">
      <div className="metric-label">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium text-[var(--cream)]">{primary}</div>
      <div className="truncate text-[11px] text-[var(--mute)]">{secondary}</div>
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
  const color =
    tone === 'warn'
      ? 'text-[var(--amber-2)]'
      : tone === 'danger'
        ? 'text-[var(--ruby)]'
        : 'text-[var(--cream)]';
  return (
    <div className="metric-tile min-w-0">
      <span className="metric-label">{label}</span>
      <span className={`metric-value block ${color}`}>{value}</span>
    </div>
  );
}

const HUD_LINKS = [
  ['/feed', 'Feed'],
  ['/news', 'News'],
  ['/leaderboards', 'Leaders'],
  ['/companies', 'Companies'],
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
