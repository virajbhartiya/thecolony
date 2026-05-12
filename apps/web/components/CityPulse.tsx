'use client';
import { useEffect, useState } from 'react';
import { fetchEndpoint } from '../lib/api';

interface Metrics {
  total_events: number;
  crime_24h: number;
  deaths_24h: number;
  births_24h: number;
  hires_24h: number;
  fires_24h: number;
  evictions_24h: number;
  wages_24h_cents: number;
  rent_24h_cents: number;
  thefts_24h_amount_cents: number;
  trades_24h: number;
  orders_24h: number;
  group_founded_24h: number;
  company_founded_24h: number;
  warrants_outstanding: number;
  jailed_now: number;
  bankrupt_now: number;
  mood_index: number;
  avg_life_satisfaction: number;
}

function fmtMoney(cents: number | string): string {
  const v = Number(cents ?? 0) / 100;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export default function CityPulse() {
  const [m, setM] = useState<Metrics | null>(null);
  useEffect(() => {
    let stopped = false;
    const tick = () =>
      fetchEndpoint<Metrics>('/v1/world/metrics')
        .then((d) => !stopped && setM(d))
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
        top: 196,
        left: 16,
        width: 280,
        padding: '10px 12px',
        zIndex: 20,
      }}
    >
      <div className="panel-title" style={{ marginBottom: 8 }}>
        ▌ CITY PULSE · LAST 24H
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, rowGap: 8 }}>
        <Pulse label="Hires" value={String(m?.hires_24h ?? 0)} accent="#95b876" />
        <Pulse label="Fires" value={String(m?.fires_24h ?? 0)} accent="#e2536e" />
        <Pulse label="Wages paid" value={fmtMoney(m?.wages_24h_cents ?? 0)} accent="#95b876" />
        <Pulse label="Rent collected" value={fmtMoney(m?.rent_24h_cents ?? 0)} accent="#cdb98a" />
        <Pulse label="Evictions" value={String(m?.evictions_24h ?? 0)} accent="#f0a347" />
        <Pulse label="Births" value={String(m?.births_24h ?? 0)} accent="#95b876" />
        <Pulse label="Theft loot" value={fmtMoney(m?.thefts_24h_amount_cents ?? 0)} accent="#e2536e" />
        <Pulse label="Trades" value={String(m?.trades_24h ?? 0)} accent="#4ec5b8" />
        <Pulse label="Open orders" value={String(m?.orders_24h ?? 0)} accent="#4ec5b8" />
        <Pulse label="Cos founded" value={String(m?.company_founded_24h ?? 0)} accent="#4ec5b8" />
        <Pulse label="Groups founded" value={String(m?.group_founded_24h ?? 0)} accent="#9b7fd1" />
        <Pulse label="Jailed now" value={String(m?.jailed_now ?? 0)} accent="#e2536e" />
        <Pulse label="Bankrupt now" value={String(m?.bankrupt_now ?? 0)} accent="#9b7fd1" />
        <Pulse label="Life sat" value={`${m?.avg_life_satisfaction?.toFixed(0) ?? '—'}/100`} accent="#4ec5b8" />
      </div>
    </div>
  );
}

function Pulse({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div className="pixel" style={{ fontSize: 8, color: '#8a8478', letterSpacing: '0.18em' }}>
        {label.toUpperCase()}
      </div>
      <div className="mono" style={{ fontSize: 12, color: accent, marginTop: 1 }}>
        {value}
      </div>
    </div>
  );
}
