'use client';
import { useEffect, useState } from 'react';
import { useWorld } from '../lib/store';
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

function fmtMoney(cents: number | string | null | undefined): string {
  const v = Number(cents ?? 0) / 100;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export default function LeftSidebar() {
  const visible = useWorld((s) => s.showLeftPanel);
  const government = useWorld((s) => s.government);
  const selectAgent = useWorld((s) => s.selectAgent);
  const toggleLeft = useWorld((s) => s.toggleLeft);
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

  const hasMayor = Boolean(government?.mayor_id);
  if (!visible) return null;

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        top: 78,
        left: 60,
        bottom: 60,
        width: 280,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
      }}
    >
      <div className="panel-header">
        <span className="panel-title">▌ CITY GOVERNMENT</span>
        <button className="iconbtn" onClick={toggleLeft} style={{ width: 18, height: 18, fontSize: 9 }}>×</button>
      </div>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #2a2236' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div
            onClick={() => government?.mayor_id && selectAgent(government.mayor_id)}
            style={{ cursor: hasMayor ? 'pointer' : 'default' }}
          >
            <Label>Mayor</Label>
            <div
              style={{
                fontSize: 13,
                color: hasMayor ? '#ffc26b' : '#5e5868',
                marginTop: 2,
                textDecoration: hasMayor ? 'underline dotted' : 'none',
                textUnderlineOffset: 3,
              }}
            >
              {government?.mayor_name ?? 'vacant'}
            </div>
          </div>
          <div>
            <Label>Treasury</Label>
            <div className="mono" style={{ fontSize: 13, color: '#95b876', marginTop: 2 }}>
              {fmtMoney(government?.treasury_cents)}
            </div>
          </div>
          <div>
            <Label>Tax rate</Label>
            <div className="mono" style={{ fontSize: 12, color: '#cdb98a', marginTop: 2 }}>
              {(Number(government?.tax_rate_bps ?? 0) / 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <Label>Election</Label>
            <div className="mono" style={{ fontSize: 11, color: '#cdb98a', marginTop: 2 }}>
              {government?.next_election_at
                ? new Date(government.next_election_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })
                : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="panel-header" style={{ borderTop: '1px solid #2a2236' }}>
        <span className="panel-title">▌ CITY PULSE · 24H</span>
        <span className="panel-tag">live db</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, rowGap: 10 }}>
          <Pulse label="Hires" value={String(m?.hires_24h ?? 0)} accent="#95b876" />
          <Pulse label="Fires" value={String(m?.fires_24h ?? 0)} accent="#e2536e" />
          <Pulse label="Wages" value={fmtMoney(m?.wages_24h_cents)} accent="#95b876" />
          <Pulse label="Rent" value={fmtMoney(m?.rent_24h_cents)} accent="#cdb98a" />
          <Pulse label="Births" value={String(m?.births_24h ?? 0)} accent="#95b876" />
          <Pulse label="Evictions" value={String(m?.evictions_24h ?? 0)} accent="#f0a347" />
          <Pulse label="Trades" value={String(m?.trades_24h ?? 0)} accent="#4ec5b8" />
          <Pulse label="Orders" value={String(m?.orders_24h ?? 0)} accent="#4ec5b8" />
          <Pulse label="Cos." value={String(m?.company_founded_24h ?? 0)} accent="#4ec5b8" />
          <Pulse label="Groups" value={String(m?.group_founded_24h ?? 0)} accent="#9b7fd1" />
          <Pulse label="Theft$" value={fmtMoney(m?.thefts_24h_amount_cents)} accent="#e2536e" />
          <Pulse label="Jailed" value={String(m?.jailed_now ?? 0)} accent="#e2536e" />
          <Pulse label="Bankrupt" value={String(m?.bankrupt_now ?? 0)} accent="#9b7fd1" />
          <Pulse
            label="Life sat"
            value={`${m?.avg_life_satisfaction?.toFixed(0) ?? '—'}`}
            accent="#4ec5b8"
          />
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
      {String(children).toUpperCase()}
    </div>
  );
}

function Pulse({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div className="pixel" style={{ fontSize: 8, color: '#8a8478', letterSpacing: '0.16em' }}>
        {label.toUpperCase()}
      </div>
      <div className="mono" style={{ fontSize: 12, color: accent, marginTop: 1 }}>
        {value}
      </div>
    </div>
  );
}
