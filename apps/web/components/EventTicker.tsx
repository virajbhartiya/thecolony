'use client';
import { useEffect, useState, useMemo } from 'react';
import { useWorld } from '../lib/store';
import { fetchEndpoint } from '../lib/api';

const KIND_COLOR: Record<string, string> = {
  agent_died: '#8e2738',
  incident_theft: '#e2536e',
  incident_assault: '#e2536e',
  incident_fraud: '#f0a347',
  incident_breach: '#f0a347',
  agent_fired: '#e2536e',
  agent_evicted: '#f0a347',
  agent_bankrupt: '#9b7fd1',
  agent_jailed: '#e2536e',
  agent_released: '#95b876',
  agent_homed: '#95b876',
  agent_hired: '#95b876',
  agent_spoke: '#ffc26b',
  agent_dm: '#ffc26b',
  agent_broadcast: '#f0a347',
  agent_paid_wage: '#95b876',
  agent_paid_rent: '#cdb98a',
  agent_ate: '#cdb98a',
  agent_bought: '#95b876',
  agent_sold: '#cdb98a',
  agent_worked: '#cdb98a',
  agent_moved: '#5e5868',
  agent_slept: '#5e5868',
  agent_reflected: '#9b7fd1',
  agent_accused: '#9b7fd1',
  trade_executed: '#95b876',
  order_placed: '#f0c84a',
  birth: '#95b876',
  migrant_arrived: '#95b876',
  group_founded: '#9b7fd1',
  group_joined: '#9b7fd1',
  group_left: '#5e5868',
  company_founded: '#4ec5b8',
  shares_issued: '#4ec5b8',
  news_headline: '#58a6ff',
};

interface LeaderRow {
  id: string;
  name: string;
  occupation?: string | null;
  balance_cents?: number;
  score?: number;
  warrants?: number;
  incidents?: number;
  severity?: number;
}

interface Leaderboards {
  richest: LeaderRow[];
  loved: LeaderRow[];
  hated: LeaderRow[];
  notorious: LeaderRow[];
}

function fmtMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const v = Math.abs(cents) / 100;
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `${sign}$${(v / 1000).toFixed(1)}k`;
  return `${sign}$${v.toFixed(0)}`;
}

function timeOf(t: string): string {
  const d = new Date(t);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function EventTicker() {
  const events = useWorld((s) => s.events);
  const agents = useWorld((s) => s.agents);
  const buildings = useWorld((s) => s.buildings);
  const select = useWorld((s) => s.selectAgent);
  const selectBuilding = useWorld((s) => s.selectBuilding);
  const panelVisible = useWorld((s) => s.showRightPanel);
  const toggleRight = useWorld((s) => s.toggleRight);

  const visible = useMemo(() => events.filter((e) => e.importance >= 1).slice(0, 18), [events]);

  const agentName = (id: string) => agents.get(id)?.name ?? id.slice(0, 6);
  const buildingName = (id: string | null) =>
    buildings.find((b) => b.id === id)?.name ?? '';

  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const r = await fetchEndpoint<Leaderboards>('/v1/leaderboards');
        if (!stopped) setLeaderboards(r);
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  if (!panelVisible) return null;

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        top: 78,
        right: 12,
        width: 320,
        bottom: 60,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
      }}
    >
      <div className="panel-header">
        <span className="panel-title">▌ LIVE FIREHOSE · {events.length}</span>
        <button className="iconbtn" onClick={toggleRight} style={{ width: 18, height: 18, fontSize: 9 }}>×</button>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: '58%', flex: '0 0 auto' }}>
        {visible.length === 0 && (
          <div style={{ padding: '14px 12px', fontSize: 12, color: '#5e5868' }}>
            No events yet. The city is waking up.
          </div>
        )}
        {visible.map((e, i) => {
          const actor = agentName(e.actor_ids[0] ?? '');
          const placeName = buildingName(e.location_id);
          return (
            <div key={e.id} className={`event-row ${i === 0 ? 'new' : ''}`}>
              <span className="t mono">{timeOf(e.t)}</span>
              <span className="dot" style={{ background: KIND_COLOR[e.kind] ?? '#8a8478' }} />
              <span className="body">
                <strong
                  style={{ cursor: 'pointer' }}
                  onClick={() => e.actor_ids[0] && select(e.actor_ids[0])}
                >
                  {actor}
                </strong>{' '}
                <span style={{ color: '#8a8478' }}>{summarize(e.kind)}</span>
                {placeName && (
                  <>
                    {' '}
                    <span
                      style={{ color: '#4ec5b8', cursor: 'pointer', textDecoration: 'underline dotted' }}
                      onClick={() => e.location_id && selectBuilding(e.location_id)}
                    >
                      {placeName}
                    </span>
                  </>
                )}
                <DetailBlurb e={e} agentName={agentName} />
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid #3a304a', flex: 1, overflowY: 'auto' }}>
        <Leaderboard
          title="Richest"
          tag="net worth"
          rows={
            leaderboards?.richest.slice(0, 5).map((r) => ({
              id: r.id,
              name: r.name,
              v: fmtMoney(r.balance_cents ?? 0),
              accent: '#95b876',
            })) ?? []
          }
          onPick={select}
        />
        <Leaderboard
          title="Most Loved"
          tag="aggregate affinity"
          rows={
            leaderboards?.loved.slice(0, 5).map((r) => ({
              id: r.id,
              name: r.name,
              v: `+${r.score ?? 0}`,
              accent: '#95b876',
            })) ?? []
          }
          onPick={select}
        />
        <Leaderboard
          title="Most Hated"
          tag="aggregate affinity"
          rows={
            leaderboards?.hated.slice(0, 5).map((r) => ({
              id: r.id,
              name: r.name,
              v: `${r.score ?? 0}`,
              accent: '#e2536e',
            })) ?? []
          }
          onPick={select}
        />
        <Leaderboard
          title="Most Notorious"
          tag="rap-sheet severity"
          rows={
            leaderboards?.notorious.slice(0, 5).map((r) => ({
              id: r.id,
              name: r.name,
              v: `${r.incidents ?? 0} · sev ${r.severity ?? 0}`,
              accent: '#9b7fd1',
            })) ?? []
          }
          onPick={select}
        />
      </div>
    </div>
  );
}

function Leaderboard({
  title,
  tag,
  rows,
  onPick,
}: {
  title: string;
  tag: string;
  rows: Array<{ id: string; name: string; v: string; accent: string }>;
  onPick: (id: string) => void;
}) {
  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid #2a2236' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <span className="panel-title" style={{ color: '#ece6d3' }}>
          {title}
        </span>
        <span className="panel-tag">{tag}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 3 }}>
        {rows.length === 0 && (
          <span className="mono" style={{ fontSize: 11, color: '#5e5868' }}>
            loading…
          </span>
        )}
        {rows.map((r, i) => (
          <span key={r.id + i} style={{ display: 'contents' }}>
            <span
              onClick={() => onPick(r.id)}
              style={{ cursor: 'pointer', fontSize: 12, color: '#ece6d3' }}
            >
              <span className="mono" style={{ color: '#5e5868', marginRight: 6 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {r.name}
            </span>
            <span className="mono" style={{ fontSize: 11, color: r.accent }}>
              {r.v}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function summarize(kind: string): string {
  const map: Record<string, string> = {
    agent_died: 'died',
    incident_theft: 'stole from',
    incident_assault: 'assaulted',
    incident_fraud: 'defrauded',
    incident_breach: 'breached contract with',
    agent_fired: 'was fired',
    agent_evicted: 'evicted',
    agent_bankrupt: 'went bankrupt',
    agent_jailed: 'jailed',
    agent_released: 'released',
    agent_homed: 'moved into',
    agent_hired: 'hired at',
    agent_spoke: 'said:',
    agent_dm: 'dm’d',
    agent_broadcast: 'broadcast:',
    agent_paid_wage: 'received wage at',
    agent_paid_rent: 'paid rent at',
    agent_ate: 'ate',
    agent_bought: 'bought at',
    agent_sold: 'sold at',
    agent_worked: 'worked at',
    agent_moved: 'moved to',
    agent_slept: 'slept',
    agent_reflected: 'reflected',
    agent_accused: 'accused',
    trade_executed: 'traded',
    order_placed: 'placed order',
    birth: 'born',
    migrant_arrived: 'arrived',
    group_founded: 'founded',
    group_joined: 'joined',
    group_left: 'left',
    company_founded: 'founded company',
    shares_issued: 'issued shares',
    news_headline: '— news:',
  };
  return map[kind] ?? kind;
}

function DetailBlurb({
  e,
  agentName,
}: {
  e: { kind: string; payload: Record<string, unknown>; actor_ids: string[] };
  agentName: (id: string) => string;
}) {
  const p = e.payload ?? {};
  if (e.kind === 'agent_spoke' || e.kind === 'agent_broadcast') {
    const body = String(p.body ?? '').slice(0, 100);
    if (!body) return null;
    return <span style={{ color: '#cdb98a' }}> “{body}”</span>;
  }
  if (e.kind === 'agent_paid_wage' || e.kind === 'agent_paid_rent') {
    const amt = Number(p.amount_cents ?? p.rent ?? 0) / 100;
    return <span style={{ color: '#95b876' }}> · ${amt.toFixed(0)}</span>;
  }
  if (e.kind === 'incident_theft') {
    const amt = Number(p.amount_cents ?? 0) / 100;
    return (
      <span style={{ color: '#e2536e' }}>
        {' '}
        · ${amt.toFixed(0)}
        {e.actor_ids[1] && (
          <>
            {' '}
            <span style={{ color: '#cdb98a' }}>from {agentName(e.actor_ids[1])}</span>
          </>
        )}
      </span>
    );
  }
  if (e.kind === 'agent_died') {
    return <span style={{ color: '#e2536e' }}> · {String(p.cause ?? 'unknown')}</span>;
  }
  if (e.kind === 'agent_hired') {
    return <span style={{ color: '#95b876' }}> as {String(p.role ?? 'worker')}</span>;
  }
  return null;
}
