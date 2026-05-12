'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWorld } from '../lib/store';
import { fetchEndpoint } from '../lib/api';

interface Metrics {
  total_events: number;
  crime_24h: number;
  deaths_24h: number;
  hires_24h: number;
  fires_24h: number;
  jailed_now: number;
  bankrupt_now: number;
  mood_index: number;
  avg_life_satisfaction: number;
  warrants_outstanding: number;
}

function fmtMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const v = Math.abs(cents) / 100;
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `${sign}$${(v / 1000).toFixed(1)}k`;
  return `${sign}$${v.toFixed(0)}`;
}

function fmtClock(t: string): string {
  const d = new Date(t);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function HUD() {
  const population = useWorld((s) => s.population);
  const gdpCents = useWorld((s) => s.gdp_cents);
  const simTime = useWorld((s) => s.simTime);
  const connected = useWorld((s) => s.connected);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffect(() => {
    let stopped = false;
    const tick = () =>
      fetchEndpoint<Metrics>('/v1/world/metrics')
        .then((m) => !stopped && setMetrics(m))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        top: 22,
        left: 12,
        right: 12,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 12px',
        zIndex: 22,
      }}
    >
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <svg width={20} height={20} viewBox="0 0 28 28">
          <rect x={2} y={14} width={24} height={12} fill="#1c1925" stroke="#f0a347" strokeWidth={1.5} />
          <rect x={6} y={6} width={6} height={20} fill="#f0a347" />
          <rect x={14} y={2} width={6} height={24} fill="#ffc26b" />
          <rect x={22} y={10} width={4} height={16} fill="#4ec5b8" />
        </svg>
        <span className="pixel" style={{ fontSize: 11, color: '#ffc26b', letterSpacing: '0.16em' }}>
          THECOLONY
        </span>
      </Link>

      <Sep />
      <Inline label="POP" value={String(population)} accent="#ece6d3" />
      <Inline label="GDP" value={fmtMoney(gdpCents)} accent="#95b876" />
      <Inline label="CLOCK" value={fmtClock(simTime)} accent="#ffc26b" />
      <Inline label="MOOD" value={`${(metrics?.mood_index ?? 0) >= 0 ? '+' : ''}${metrics?.mood_index ?? 0}`} accent={(metrics?.mood_index ?? 0) < 0 ? '#e2536e' : '#95b876'} />
      <Inline label="CRIME 24H" value={String(metrics?.crime_24h ?? 0)} accent={(metrics?.crime_24h ?? 0) > 0 ? '#e2536e' : '#cdb98a'} />
      <Inline label="DEATHS" value={String(metrics?.deaths_24h ?? 0)} accent={(metrics?.deaths_24h ?? 0) > 0 ? '#e2536e' : '#cdb98a'} />
      <Inline label="JAILED" value={String(metrics?.jailed_now ?? 0)} accent="#f0a347" />

      <div style={{ flex: 1 }} />

      <nav style={{ display: 'flex', gap: 4 }}>
        {[
          ['/feed', 'Feed'],
          ['/news', 'News'],
          ['/leaderboards', 'Leaders'],
          ['/market', 'Market'],
          ['/companies', 'Cos'],
          ['/crime', 'Crime'],
          ['/groups', 'Groups'],
          ['/history', 'History'],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="chip" style={{ textDecoration: 'none', padding: '2px 7px' }}>
            {label}
          </Link>
        ))}
      </nav>

      <Sep />
      <span
        className="pill"
        style={{ color: connected ? '#95b876' : '#8a8478', padding: '1px 5px' }}
      >
        <span style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%' }} />
        {connected ? 'LIVE' : 'CONN…'}
      </span>
    </div>
  );
}

function Sep() {
  return <span style={{ width: 1, alignSelf: 'stretch', background: '#2a2236', margin: '4px 0' }} />;
}

function Inline({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
      <span className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.16em' }}>
        {label}
      </span>
      <span className="mono" style={{ fontSize: 13, color: accent }}>
        {value}
      </span>
    </span>
  );
}
