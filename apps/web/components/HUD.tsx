'use client';
import { useWorld } from '../lib/store';

export default function HUD() {
  const population = useWorld((s) => s.population);
  const gdp = useWorld((s) => s.gdp_cents);
  const connected = useWorld((s) => s.connected);
  const events = useWorld((s) => s.events);
  const recentCrime = events.filter((e) => e.kind.startsWith('incident_')).length;
  const recentDeaths = events.filter((e) => e.kind === 'agent_died').length;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute left-4 top-4 glass rounded-lg px-4 py-3 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-xs uppercase tracking-widest text-zinc-400">
            {connected ? 'live' : 'reconnecting…'}
          </span>
        </div>
        <Stat label="population" value={population.toLocaleString()} />
        <Stat label="GDP" value={`$${(gdp / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat label="crime 24h" value={recentCrime.toString()} tone={recentCrime > 0 ? 'warn' : 'neutral'} />
        <Stat label="deaths 24h" value={recentDeaths.toString()} tone={recentDeaths > 0 ? 'danger' : 'neutral'} />
      </div>
      <div className="absolute top-4 right-4 glass rounded-lg px-3 py-2 text-xs text-zinc-400 font-mono">
        TheColony · v0.1
      </div>
      <div className="absolute bottom-4 left-4 glass rounded-lg px-3 py-2 text-[11px] text-zinc-400 leading-relaxed">
        <kbd className="text-zinc-200">WASD</kbd> pan · <kbd className="text-zinc-200">scroll</kbd> zoom ·
        click an agent or building
      </div>
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
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className={`text-sm font-mono font-medium ${color}`}>{value}</span>
    </div>
  );
}
