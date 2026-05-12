'use client';
import { useEffect, useMemo, useState } from 'react';
import { useWorld } from '../lib/store';
import { fetchEndpoint } from '../lib/api';
import BuildingSprite from './sprites/BuildingSprite';

interface BuildingDetail {
  building: {
    id: string;
    name: string;
    kind: string;
    zone_kind: string;
    tile_x: number;
    tile_y: number;
    tile_w: number;
    tile_h: number;
    capacity: number;
    rent_cents: number;
    sprite_key: string;
  };
  company: {
    id: string;
    name: string;
    industry: string | null;
    treasury_cents: number;
    founder_id: string | null;
    charter: Record<string, unknown> | null;
  } | null;
  occupants: Array<{
    id: string;
    name: string;
    occupation: string | null;
    state: string;
    balance_cents: number;
    portrait_seed: string | null;
  }>;
  employees: Array<{
    id: string;
    name: string;
    occupation: string | null;
    wage_cents: number;
    portrait_seed: string | null;
  }>;
  inventory: Array<{ key: string; qty: number }>;
  transactions: Array<{
    id: number;
    t: string;
    reason: string;
    amount_cents: number;
    debit_kind: string;
    credit_kind: string;
  }>;
}

function fmtMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const v = Math.abs(cents) / 100;
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `${sign}$${(v / 1000).toFixed(1)}k`;
  return `${sign}$${v.toFixed(0)}`;
}

export default function BuildingDrawer() {
  const id = useWorld((s) => s.selectedBuildingId);
  const close = useWorld((s) => s.selectBuilding);
  const select = useWorld((s) => s.selectAgent);
  const buildings = useWorld((s) => s.buildings);
  const localBuilding = useMemo(() => (id ? buildings.find((b) => b.id === id) ?? null : null), [id, buildings]);

  const [detail, setDetail] = useState<BuildingDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setDetail(null);
    setLoading(true);
    const tick = () =>
      fetchEndpoint<BuildingDetail>(`/v1/building/${id}`)
        .then(setDetail)
        .catch(() => setDetail(null))
        .finally(() => setLoading(false));
    tick();
    const t = setInterval(tick, 4000);
    return () => clearInterval(t);
  }, [id]);

  if (!id || !localBuilding) return null;
  const b = detail?.building ?? localBuilding;

  return (
    <div className="drawer">
      <div className="panel-header teal">
        <span className="panel-title" style={{ color: '#7ee8d8' }}>
          ▌ BUILDING RECORD
        </span>
        <button className="iconbtn" onClick={() => close(null)} title="close">
          ×
        </button>
      </div>

      <div className="drawer-scroll">
        <div className="drawer-section" style={{ display: 'flex', gap: 14 }}>
          <BuildingThumb b={b} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="pixel"
              style={{ fontSize: 16, color: '#4ec5b8', letterSpacing: '0.06em', lineHeight: 1.1 }}
            >
              {b.name}
            </div>
            <div className="mono" style={{ fontSize: 10, color: '#8a8478', marginTop: 4 }}>
              ID {b.id.slice(0, 8)} · TILE ({b.tile_x}, {b.tile_y}) · {b.tile_w}×{b.tile_h}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="pill" style={{ color: '#cdb98a' }}>
                {b.kind.replace(/_/g, ' ')}
              </span>
              <span className="pill" style={{ color: '#9b7fd1' }}>
                {b.zone_kind}
              </span>
              {b.rent_cents > 0 && (
                <span className="pill" style={{ color: '#95b876' }}>
                  rent ${(b.rent_cents / 100).toFixed(0)}/day
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="drawer-section">
          <h4>Stats</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Stat label="Capacity" value={`${b.capacity}`} mono />
            <Stat
              label="Treasury"
              value={detail?.company ? fmtMoney(Number(detail.company.treasury_cents)) : '—'}
              accent="#cdb98a"
              mono
            />
            <Stat label="Occupants" value={detail ? `${detail.occupants.length}` : '—'} mono />
            <Stat label="Employees" value={detail ? `${detail.employees.length}` : '—'} mono />
          </div>
        </div>

        {detail?.company && (
          <div className="drawer-section">
            <h4>Company</h4>
            <div style={{ fontSize: 13, color: '#ece6d3' }}>
              <strong style={{ color: '#4ec5b8' }}>{detail.company.name}</strong>
              {detail.company.industry && (
                <span className="mono" style={{ color: '#8a8478', marginLeft: 6 }}>
                  · {detail.company.industry}
                </span>
              )}
            </div>
            {detail.company.charter && (
              <div
                className="mono"
                style={{ fontSize: 11, color: '#cdb98a', marginTop: 6, lineHeight: 1.4 }}
              >
                {Object.entries(detail.company.charter)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </div>
            )}
          </div>
        )}

        {detail && detail.occupants.length > 0 && (
          <div className="drawer-section">
            <h4>Inside now · {detail.occupants.length}</h4>
            {detail.occupants.slice(0, 12).map((a) => (
              <Row
                key={a.id}
                onClick={() => select(a.id)}
                name={a.name}
                hint={`${a.state} · ${a.occupation ?? '—'}`}
                rhs={fmtMoney(Number(a.balance_cents))}
              />
            ))}
          </div>
        )}

        {detail && detail.employees.length > 0 && (
          <div className="drawer-section">
            <h4>Employees · {detail.employees.length}</h4>
            {detail.employees.slice(0, 12).map((e) => (
              <Row
                key={e.id}
                onClick={() => select(e.id)}
                name={e.name}
                hint={e.occupation ?? 'worker'}
                rhs={`$${(Number(e.wage_cents) / 100).toFixed(0)}/d`}
              />
            ))}
          </div>
        )}

        {detail && detail.transactions.length > 0 && (
          <div className="drawer-section">
            <h4>Recent transactions</h4>
            {detail.transactions.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="mono"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr auto',
                  gap: 8,
                  fontSize: 11,
                  color: '#cdb98a',
                  padding: '3px 0',
                  borderBottom: '1px dashed #2a2236',
                }}
              >
                <span style={{ color: '#5e5868' }}>
                  {new Date(t.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>{t.reason}</span>
                <span
                  style={{
                    color: t.credit_kind === 'company' ? '#95b876' : '#e2536e',
                  }}
                >
                  {t.credit_kind === 'company' ? '+' : '-'}${(Number(t.amount_cents) / 100).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}

        {detail && detail.inventory.length > 0 && (
          <div className="drawer-section">
            <h4>Inventory</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {detail.inventory.map((it) => (
                <div
                  key={it.key}
                  style={{ border: '1px solid #2a2236', padding: '6px 8px', background: '#1c1925' }}
                >
                  <div
                    className="pixel"
                    style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}
                  >
                    {it.key.toUpperCase()}
                  </div>
                  <div className="mono" style={{ fontSize: 13, color: '#ece6d3' }}>
                    {it.qty}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && !detail && (
          <div className="drawer-section" style={{ fontSize: 12, color: '#5e5868' }}>
            loading record…
          </div>
        )}
      </div>
    </div>
  );
}

function BuildingThumb({ b }: { b: BuildingDetail['building'] }) {
  return (
    <svg
      width={84}
      height={84}
      viewBox="-50 -50 100 100"
      style={{ background: '#1c1925', border: '1px solid #3a304a' }}
    >
      <BuildingSprite
        b={{
          id: b.id,
          kind: b.kind,
          name: b.name,
          tile_x: 0,
          tile_y: 0,
          tile_w: 2,
          tile_h: 2,
        }}
        lit
      />
    </svg>
  );
}

function Row({
  name,
  hint,
  rhs,
  onClick,
}: {
  name: string;
  hint: string;
  rhs?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: '1px dashed #2a2236',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: '#ece6d3' }}>{name}</div>
        <div className="mono" style={{ fontSize: 9, color: '#8a8478' }}>
          {hint}
        </div>
      </div>
      {rhs && (
        <span className="mono" style={{ fontSize: 10, color: '#cdb98a' }}>
          {rhs}
        </span>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <div style={{ border: '1px solid #2a2236', padding: '6px 8px', background: '#1c1925' }}>
      <div className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
        {label.toUpperCase()}
      </div>
      <div
        className={mono ? 'mono' : undefined}
        style={{ fontSize: 13, color: accent ?? '#ece6d3', marginTop: 2 }}
      >
        {value}
      </div>
    </div>
  );
}
