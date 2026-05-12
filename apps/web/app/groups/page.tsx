'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, Panel, timeLabel, money } from '../../components/PageChrome';
import { eventText } from '../../components/EventText';
import { fetchEndpoint } from '../../lib/api';

interface Group {
  id: string;
  name: string;
  kind: string;
  founder_id: string;
  founder_name: string | null;
  doctrine: string;
  member_count: number;
  founded_at: string;
  avg_ideology: number;
  avg_balance_cents: number;
  avg_life_sat: number;
}

interface Member {
  id: string;
  name: string;
  occupation: string | null;
  balance_cents: number;
  role: string;
  joined_at: string;
}

interface GroupEvent {
  id: number;
  t: string;
  kind: string;
  actor_ids: string[];
  payload: Record<string, unknown>;
}

interface Resp {
  groups: Group[];
  members: Record<string, Member[]>;
  recentActivity: GroupEvent[];
}

const KIND_TONE: Record<string, string> = {
  cult: '#9b7fd1',
  party: '#4ec5b8',
  union: '#f0a347',
  club: '#95b876',
};

export default function GroupsPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      fetchEndpoint<Resp>('/v1/groups')
        .then(setData)
        .catch((e) => setError((e as Error).message));
    tick();
    const id = setInterval(tick, 6000);
    return () => clearInterval(id);
  }, []);

  if (error) return <PageChrome title="Groups"><EmptyState>{error}</EmptyState></PageChrome>;
  if (!data) return <PageChrome title="Groups"><EmptyState>Loading factions…</EmptyState></PageChrome>;

  return (
    <PageChrome title="Groups" eyebrow="parties · unions · cults · clubs">
      {data.groups.length === 0 && (
        <EmptyState>
          No formal factions yet. Ambitious agents will found unions, parties, clubs, and cults as the city matures.
        </EmptyState>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {data.groups.map((g) => {
            const tone = KIND_TONE[g.kind] ?? '#cdb98a';
            const members = data.members[g.id] ?? [];
            const lean = g.avg_ideology;
            return (
              <Panel key={g.id} style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div className="pixel" style={{ fontSize: 10, color: tone, letterSpacing: '0.18em' }}>
                      {g.kind.toUpperCase()}
                    </div>
                    <h2
                      className="pixel"
                      style={{
                        margin: '6px 0 4px',
                        fontSize: 20,
                        color: '#ffc26b',
                        letterSpacing: '0.06em',
                        fontWeight: 400,
                      }}
                    >
                      {g.name}
                    </h2>
                    <div className="mono" style={{ fontSize: 10, color: '#8a8478' }}>
                      Founded by{' '}
                      <Link
                        href={`/agent/${g.founder_id}`}
                        style={{ color: '#ffc26b', textDecoration: 'underline dotted' }}
                      >
                        {g.founder_name ?? 'unknown'}
                      </Link>{' '}
                      · {timeLabel(g.founded_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
                      MEMBERS
                    </div>
                    <div className="mono" style={{ fontSize: 22, color: tone, lineHeight: 1 }}>
                      {g.member_count}
                    </div>
                  </div>
                </div>

                <p style={{ marginTop: 12, fontSize: 13, color: '#cdb98a', lineHeight: 1.5, fontStyle: 'italic' }}>
                  “{g.doctrine}”
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
                  <Aggregate label="Ideology lean" value={ideologyLabel(lean)} accent={lean < 0 ? '#9b7fd1' : '#4ec5b8'} />
                  <Aggregate label="Avg wallet" value={money(g.avg_balance_cents)} accent="#95b876" />
                  <Aggregate
                    label="Avg life sat"
                    value={`${Math.round(g.avg_life_sat)}/100`}
                    accent="#4ec5b8"
                  />
                </div>

                {members.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: '1px dashed #2a2236', paddingTop: 10 }}>
                    <div
                      className="pixel"
                      style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em', marginBottom: 6 }}
                    >
                      MEMBERS · TOP 8
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {members.slice(0, 8).map((m) => (
                        <Link
                          key={m.id}
                          href={`/agent/${m.id}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: 6,
                            padding: '3px 6px',
                            border: '1px solid #2a2236',
                            background: '#1c1925',
                            textDecoration: 'none',
                            color: '#ece6d3',
                          }}
                        >
                          <span style={{ fontSize: 11, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.role === 'founder' && (
                              <span style={{ color: tone, marginRight: 4 }}>★</span>
                            )}
                            {m.name}
                          </span>
                          <span className="mono" style={{ fontSize: 10, color: '#cdb98a' }}>
                            {money(m.balance_cents)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>

        <Panel style={{ overflow: 'hidden', alignSelf: 'flex-start' }}>
          <div className="panel-header">
            <span className="panel-title">▌ FACTION ACTIVITY</span>
            <span className="panel-tag">{data.recentActivity.length} events</span>
          </div>
          <div>
            {data.recentActivity.length === 0 && (
              <div style={{ padding: '14px 12px', fontSize: 12, color: '#5e5868' }}>
                No faction events yet.
              </div>
            )}
            {data.recentActivity.slice(0, 30).map((event) => (
              <div
                key={event.id}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px dashed #2a2236',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                <div
                  className="pixel"
                  style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em', marginBottom: 3 }}
                >
                  {event.kind.replace(/_/g, ' ').toUpperCase()} · {timeLabel(event.t)}
                </div>
                <div style={{ color: '#ece6d3' }}>{eventText(event.kind, event.payload)}</div>
                {event.actor_ids[0] && (
                  <Link
                    href={`/agent/${event.actor_ids[0]}`}
                    className="mono"
                    style={{
                      marginTop: 4,
                      display: 'inline-block',
                      fontSize: 10,
                      color: '#ffc26b',
                      textDecoration: 'underline dotted',
                    }}
                  >
                    open actor →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageChrome>
  );
}

function Aggregate({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ border: '1px solid #2a2236', padding: '6px 8px', background: '#1c1925' }}>
      <div className="pixel" style={{ fontSize: 8, color: '#8a8478', letterSpacing: '0.18em' }}>
        {label.toUpperCase()}
      </div>
      <div className="mono" style={{ fontSize: 13, color: accent, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function ideologyLabel(v: number): string {
  if (v < -0.5) return `left ${v.toFixed(2)}`;
  if (v > 0.5) return `right +${v.toFixed(2)}`;
  if (v < -0.15) return `center-left ${v.toFixed(2)}`;
  if (v > 0.15) return `center-right +${v.toFixed(2)}`;
  return `centrist ${v.toFixed(2)}`;
}
