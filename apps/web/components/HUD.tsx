'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useWorld } from '../lib/store';

const NAV: Array<[string, string]> = [
  ['/', 'Live'],
  ['/feed', 'Feed'],
  ['/news', 'News'],
  ['/leaderboards', 'Leaders'],
  ['/companies', 'Companies'],
  ['/market', 'Market'],
  ['/crime', 'Crime'],
  ['/groups', 'Groups'],
  ['/history', 'History'],
  ['/about', 'About'],
];

function fmtMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const v = Math.abs(cents) / 100;
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `${sign}$${(v / 1000).toFixed(1)}k`;
  return `${sign}$${v.toFixed(0)}`;
}

function fmtSimClock(t: string): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtSimDate(t: string): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '—';
  return `D${Math.floor((d.getTime() - new Date('2125-01-01').getTime()) / 86_400_000)}`;
}

function moodLabel(v: number): string {
  if (v <= -20) return 'restless';
  if (v <= -8) return 'sour';
  if (v < 8) return 'flat';
  if (v < 20) return 'warming';
  return 'lifted';
}

export default function HUD() {
  const population = useWorld((s) => s.population);
  const gdpCents = useWorld((s) => s.gdp_cents);
  const simTime = useWorld((s) => s.simTime);
  const connected = useWorld((s) => s.connected);
  const paused = useWorld((s) => s.paused);
  const speed = useWorld((s) => s.speed);
  const events = useWorld((s) => s.events);

  const crime24h = useMemo(
    () => events.filter((e) => e.kind.startsWith('incident_')).length,
    [events],
  );
  const deaths24h = useMemo(
    () => events.filter((e) => e.kind === 'agent_died').length,
    [events],
  );
  const warrants = useMemo(
    () => events.filter((e) => e.kind === 'agent_accused' || e.kind === 'incident_theft' || e.kind === 'incident_assault').length,
    [events],
  );

  // mood index — coarse approximation from event mix
  const mood = useMemo(() => {
    const happy = events.filter((e) =>
      ['agent_paid_wage', 'agent_hired', 'agent_ate', 'agent_homed', 'group_joined', 'birth'].includes(e.kind),
    ).length;
    const sad = events.filter((e) =>
      ['agent_died', 'agent_evicted', 'agent_fired', 'incident_theft', 'incident_assault', 'agent_bankrupt'].includes(
        e.kind,
      ),
    ).length;
    return happy - sad;
  }, [events]);

  const [wallTime, setWallTime] = useState('');
  useEffect(() => {
    const id = setInterval(
      () => setWallTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      1000,
    );
    setWallTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    return () => clearInterval(id);
  }, []);

  const tick = events[0]?.id ?? 0;

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        height: 60,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        zIndex: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 16px',
          borderRight: '1px solid #2a2236',
          height: '100%',
        }}
      >
        <svg width={28} height={28} viewBox="0 0 28 28">
          <rect x={2} y={14} width={24} height={12} fill="#1c1925" stroke="#f0a347" strokeWidth={1.5} />
          <rect x={6} y={6} width={6} height={20} fill="#f0a347" />
          <rect x={14} y={2} width={6} height={24} fill="#ffc26b" />
          <rect x={22} y={10} width={4} height={16} fill="#4ec5b8" />
          <rect x={0} y={26} width={28} height={2} fill="#0b0a10" />
        </svg>
        <div>
          <div className="pixel" style={{ fontSize: 14, color: '#ffc26b', letterSpacing: '0.16em' }}>
            THECOLONY
          </div>
          <div className="mono" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
            LIVE · TICK {tick.toLocaleString()}
          </div>
        </div>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          {NAV.slice(0, 1).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="chip"
              style={{ textDecoration: 'none' }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
        <Metric label="SIM CLOCK" value={fmtSimClock(simTime)} sub={fmtSimDate(simTime)} accent="#ffc26b" />
        <Metric label="POPULATION" value={String(population)} sub={`alive · ${connected ? 'streaming' : 'offline'}`} />
        <Metric
          label="GDP / SIM-DAY"
          value={fmtMoney(gdpCents)}
          sub={<span className={gdpCents >= 0 ? 'delta-up' : 'delta-down'}>{gdpCents >= 0 ? '▲' : '▼'} agent wallets</span>}
        />
        <Metric
          label="CRIME 24H"
          value={`${crime24h}`}
          sub={<span className="delta-down">▲ {warrants} warrants</span>}
        />
        <Metric
          label="MOOD INDEX"
          value={`${mood >= 0 ? '+' : ''}${mood}`}
          sub={<span style={{ color: mood < 0 ? '#e2536e' : '#95b876' }}>{moodLabel(mood)}</span>}
          accent={mood < 0 ? '#e2536e' : '#95b876'}
        />
        <Metric
          label="DEATHS 24H"
          value={`${deaths24h}`}
          sub={<span style={{ color: deaths24h > 0 ? '#e2536e' : '#8a8478' }}>obituaries</span>}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 14px' }}>
        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV.slice(1, 6).map(([href, label]) => (
            <Link key={href} href={href} className="chip" style={{ textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="mono" style={{ fontSize: 10, color: '#8a8478', textAlign: 'right' }}>
          <div>WALL · {wallTime}</div>
          <div>SPEED · {paused ? '0×' : `${speed}×`}</div>
        </div>
        <span
          className="pill"
          style={{ color: paused ? '#f0a347' : connected ? '#95b876' : '#8a8478' }}
        >
          <span
            style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%' }}
          />
          {paused ? 'PAUSED' : connected ? 'LIVE' : 'CONN…'}
        </span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: accent ?? '#ece6d3' }}>
        {value}
      </div>
      <div className="metric-delta">{sub}</div>
    </div>
  );
}
