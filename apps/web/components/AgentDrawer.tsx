'use client';
import { useEffect, useState } from 'react';
import { useWorld } from '../lib/store';
import { fetchAgent } from '../lib/api';
import Portrait from './Portrait';

interface AgentDetail {
  agent: {
    id: string;
    name: string;
    age_years: number;
    balance_cents: number;
    status: 'alive' | 'jailed' | 'bankrupt' | 'dead';
    state: string;
    occupation: string | null;
    needs: {
      hunger: number;
      energy: number;
      social: number;
      money_anxiety: number;
      life_satisfaction: number;
    };
    traits: Record<string, number>;
    portrait_seed: string;
    pos_x: number;
    pos_y: number;
  };
  job: {
    role: string;
    wage_cents: number;
    company: string;
    industry: string | null;
    building: string | null;
  } | null;
  home: { id: string; name: string; kind: string; rent_cents: number } | null;
  inventory: Array<{ key: string; qty: number }>;
  holdings: Array<{
    company: string;
    ticker: string | null;
    shares: number;
    last_price_cents: number | null;
    market_value_cents: number | null;
  }>;
  recentEvents: Array<{ id: number; t: string; kind: string; payload: Record<string, unknown> }>;
  memories: Array<{ id: number; t: string; kind: string; summary: string; salience: number }>;
  relationships: Array<{ subj_id: string; obj_id: string; affinity: number; trust: number; tags: string[] | null }>;
}

function fmtMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const v = Math.abs(cents) / 100;
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `${sign}$${(v / 1000).toFixed(1)}k`;
  return `${sign}$${v.toFixed(0)}`;
}

const PILL_BY_STATUS: Record<string, string> = {
  alive: 'alive',
  jailed: 'jailed',
  bankrupt: 'bankrupt',
  dead: 'dead',
};

export default function AgentDrawer() {
  const id = useWorld((s) => s.selectedAgentId);
  const close = useWorld((s) => s.selectAgent);
  const toggleFollow = useWorld((s) => s.toggleFollow);
  const isFollow = useWorld((s) => s.followAgentId === id);
  const agents = useWorld((s) => s.agents);
  const live = id ? agents.get(id) : null;
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setDetail(null);
    setLoading(true);
    const tick = () =>
      fetchAgent(id)
        .then((d) => setDetail(d))
        .catch(() => setDetail(null))
        .finally(() => setLoading(false));
    tick();
    const t = setInterval(tick, 4000);
    return () => clearInterval(t);
  }, [id]);

  if (!id) return null;

  const d = detail;
  const balance = d?.agent.balance_cents ?? live?.balance_cents ?? 0;
  const state = d?.agent.state ?? live?.state ?? '—';
  const status = d?.agent.status ?? (live?.status as AgentDetail['agent']['status']) ?? 'alive';
  const occupation = d?.agent.occupation ?? live?.occupation ?? 'unemployed';
  const portraitSeed = d?.agent.portrait_seed ?? live?.portrait_seed ?? '';
  const name = d?.agent.name ?? live?.name ?? '…';

  return (
    <div className="drawer">
      <div className="panel-header">
        <span className="panel-title">▌ AGENT DOSSIER</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="iconbtn"
            title="Follow camera"
            onClick={() => toggleFollow(id)}
            style={isFollow ? { background: '#b9722a', color: '#0b0a10' } : undefined}
          >
            F
          </button>
          <button className="iconbtn" onClick={() => close(null)} title="close">
            ×
          </button>
        </div>
      </div>

      <div className="drawer-scroll">
        <div className="drawer-section" style={{ display: 'flex', gap: 14 }}>
          <Portrait seed={portraitSeed} size={84} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="pixel"
              style={{ fontSize: 16, color: '#ffc26b', letterSpacing: '0.08em', lineHeight: 1.1 }}
            >
              {name}
            </div>
            <div className="mono" style={{ fontSize: 10, color: '#8a8478', marginTop: 4 }}>
              ID {id.slice(0, 8)} · {d ? `AGE ${d.agent.age_years}` : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#ece6d3', marginTop: 6 }}>{occupation}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span className={`pill ${PILL_BY_STATUS[status] ?? 'alive'}`}>{status}</span>
              <span className="pill" style={{ color: '#cdb98a' }}>
                {state.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        <div className="drawer-section">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Stat label="Balance" value={fmtMoney(balance)} accent={balance < 0 ? '#e2536e' : '#95b876'} />
            <Stat label="State" value={state.toUpperCase()} accent="#ffc26b" mono />
            {d?.home && <Stat label="Home" value={d.home.name} />}
            {d?.job && <Stat label="Work" value={d.job.building ?? d.job.company} />}
          </div>
        </div>

        {d && (
          <div className="drawer-section">
            <h4>Needs</h4>
            {([
              ['hunger', d.agent.needs.hunger, '#e2536e'],
              ['energy', d.agent.needs.energy, '#95b876'],
              ['social', d.agent.needs.social, '#9b7fd1'],
              ['money_anxiety', d.agent.needs.money_anxiety, '#ffc26b'],
              ['life_satisfaction', d.agent.needs.life_satisfaction, '#4ec5b8'],
            ] as Array<[string, number, string]>).map(([k, v, c]) => (
              <div
                key={k}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 28px',
                  gap: 8,
                  marginBottom: 5,
                  alignItems: 'center',
                }}
              >
                <span className="mono" style={{ fontSize: 10, color: '#8a8478' }}>
                  {k}
                </span>
                <div className="bar">
                  <i style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: c }} />
                </div>
                <span
                  className="mono"
                  style={{ fontSize: 10, color: '#ece6d3', textAlign: 'right' }}
                >
                  {Math.round(v)}
                </span>
              </div>
            ))}
          </div>
        )}

        {d && (
          <div className="drawer-section">
            <h4>Traits</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(
                ['greed', 'risk', 'empathy', 'ambition', 'sociability', 'paranoia'] as const
              ).map((k) => (
                <div
                  key={k}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '78px 1fr',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <span className="mono" style={{ fontSize: 10, color: '#8a8478' }}>
                    {k}
                  </span>
                  <div className="bar">
                    <i
                      style={{
                        width: `${(d.agent.traits[k] ?? 0) * 100}%`,
                        background: '#cdb98a',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {d?.job && (
          <div className="drawer-section">
            <h4>Employment</h4>
            <div style={{ fontSize: 12, color: '#ece6d3' }}>
              <div>
                {d.job.role} at <strong style={{ color: '#4ec5b8' }}>{d.job.company}</strong>
                {d.job.industry && (
                  <span className="mono" style={{ color: '#8a8478', marginLeft: 6 }}>
                    · {d.job.industry}
                  </span>
                )}
              </div>
              <div className="mono" style={{ fontSize: 11, color: '#cdb98a', marginTop: 4 }}>
                wage · ${(Number(d.job.wage_cents) / 100).toFixed(0)} / sim-day
              </div>
            </div>
          </div>
        )}

        {d && d.memories.length > 0 && (
          <div className="drawer-section">
            <h4>Recent memories</h4>
            {d.memories.slice(0, 6).map((m) => (
              <div
                key={m.id}
                style={{
                  background: '#1c1925',
                  border: '1px solid #2a2236',
                  borderLeft: `3px solid ${kindColor(m.kind)}`,
                  padding: '8px 10px',
                  marginBottom: 6,
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}
                >
                  <span
                    className="pixel"
                    style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.16em' }}
                  >
                    {m.kind.toUpperCase()}
                  </span>
                  <span className="mono" style={{ fontSize: 9, color: '#5e5868' }}>
                    sal {m.salience.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#ece6d3', lineHeight: 1.4 }}>{m.summary}</div>
              </div>
            ))}
          </div>
        )}

        {d && d.relationships.length > 0 && (
          <div className="drawer-section">
            <h4>Top relationships</h4>
            {d.relationships.slice(0, 6).map((r) => (
              <RelationRow key={r.obj_id} r={r} />
            ))}
          </div>
        )}

        {d && d.recentEvents.length > 0 && (
          <div className="drawer-section">
            <h4>Recent events</h4>
            <div style={{ display: 'grid', gap: 3 }}>
              {d.recentEvents.slice(0, 10).map((e) => (
                <div
                  key={e.id}
                  className="mono"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '52px 1fr',
                    gap: 8,
                    fontSize: 11,
                    color: '#cdb98a',
                    padding: '2px 0',
                    borderBottom: '1px dashed #2a2236',
                  }}
                >
                  <span style={{ color: '#5e5868' }}>
                    {new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>{e.kind.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {d && d.holdings.length > 0 && (
          <div className="drawer-section">
            <h4>Holdings</h4>
            <div className="mono" style={{ fontSize: 11, color: '#cdb98a' }}>
              {d.holdings.slice(0, 6).map((h, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}
                >
                  <span>
                    {h.company} · {h.shares} sh
                  </span>
                  <span style={{ color: '#ece6d3' }}>{fmtMoney(Number(h.market_value_cents ?? 0))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {d && d.inventory.length > 0 && (
          <div className="drawer-section">
            <h4>Inventory</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {d.inventory.map((it) => (
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

        {loading && !d && (
          <div className="drawer-section" style={{ fontSize: 12, color: '#5e5868' }}>
            loading dossier…
          </div>
        )}
      </div>
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

function RelationRow({
  r,
}: {
  r: { obj_id: string; affinity: number; trust: number; tags: string[] | null };
}) {
  const select = useWorld((s) => s.selectAgent);
  const otherName = useWorld((s) => s.agents.get(r.obj_id))?.name ?? r.obj_id.slice(0, 6);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 8,
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: '1px dashed #2a2236',
        cursor: 'pointer',
      }}
      onClick={() => select(r.obj_id)}
    >
      <div>
        <div style={{ fontSize: 12, color: '#ece6d3' }}>{otherName}</div>
        {(r.tags ?? []).length > 0 && (
          <div className="mono" style={{ fontSize: 9, color: '#8a8478' }}>
            {(r.tags ?? []).join(' · ')}
          </div>
        )}
      </div>
      <AffinityChip label="aff" v={r.affinity} />
      <AffinityChip label="trust" v={r.trust} />
    </div>
  );
}

function AffinityChip({ label, v }: { label: string; v: number }) {
  const color = v >= 30 ? '#95b876' : v <= -30 ? '#e2536e' : '#cdb98a';
  return (
    <div style={{ minWidth: 48, textAlign: 'right' }}>
      <div className="pixel" style={{ fontSize: 8, color: '#5e5868', letterSpacing: '0.18em' }}>
        {label.toUpperCase()}
      </div>
      <div className="mono" style={{ fontSize: 11, color }}>
        {v > 0 ? '+' : ''}
        {Math.round(v)}
      </div>
    </div>
  );
}

function kindColor(k: string): string {
  if (k === 'reflection') return '#9b7fd1';
  if (k === 'belief') return '#cdb98a';
  if (k === 'rumor') return '#f0a347';
  return '#4ec5b8';
}
