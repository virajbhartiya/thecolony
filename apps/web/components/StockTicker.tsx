'use client';
import { useEffect, useState } from 'react';
import { fetchEndpoint } from '../lib/api';

interface Company {
  id: string;
  name: string;
  ticker: string | null;
  last_price_cents: number | null;
  previous_price_cents: number | null;
  open_orders: number;
  treasury_cents: number;
}

interface MarketResp {
  companies: Company[];
}

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function pct(last: number | null, prev: number | null): { label: string; tone: string } {
  if (!last || !prev) return { label: '—', tone: '#8a8478' };
  const change = ((last - prev) / prev) * 100;
  const sign = change > 0 ? '+' : '';
  const tone = Math.abs(change) < 0.01 ? '#cdb98a' : change > 0 ? '#95b876' : '#e2536e';
  return { label: `${sign}${change.toFixed(1)}%`, tone };
}

export default function StockTicker() {
  const [companies, setCompanies] = useState<Company[]>([]);
  useEffect(() => {
    let stopped = false;
    const tick = () =>
      fetchEndpoint<MarketResp>('/v1/market')
        .then((m) => !stopped && setCompanies(m.companies ?? []))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  const tradable = companies
    .filter((c) => c.last_price_cents !== null && c.ticker)
    .slice(0, 14);

  if (tradable.length === 0) return null;

  // Render two copies for seamless infinite scroll.
  const items = [...tradable, ...tradable];

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 22,
        background: '#08070d',
        borderBottom: '1px solid #2a2236',
        overflow: 'hidden',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        className="pixel"
        style={{
          flex: '0 0 auto',
          padding: '0 12px',
          fontSize: 10,
          color: '#ffc26b',
          letterSpacing: '0.18em',
          background: '#1c1925',
          borderRight: '1px solid #3a304a',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        ▌ COLONY EXCHANGE
      </div>
      <div style={{ overflow: 'hidden', flex: 1, position: 'relative', height: '100%' }}>
        <div className="ticker-scroll" style={{ display: 'flex', alignItems: 'center', gap: 22, height: '100%', paddingLeft: 12 }}>
          {items.map((c, i) => {
            const p = pct(c.last_price_cents, c.previous_price_cents);
            return (
              <span key={`${c.id}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <span className="pixel" style={{ fontSize: 10, color: '#cdb98a', letterSpacing: '0.06em' }}>
                  {c.ticker}
                </span>
                <span className="mono" style={{ fontSize: 11, color: '#ece6d3' }}>
                  {fmtPrice(c.last_price_cents ?? 0)}
                </span>
                <span className="mono" style={{ fontSize: 11, color: p.tone }}>
                  {p.label}
                </span>
                <span style={{ color: '#3a304a' }}>·</span>
              </span>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes ticker-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-scroll {
          animation: ticker-marquee 60s linear infinite;
        }
      `}</style>
    </div>
  );
}
