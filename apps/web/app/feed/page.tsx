'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, Panel, timeLabel } from '../../components/PageChrome';
import { eventText } from '../../components/EventText';
import { fetchEvents } from '../../lib/api';

interface EventRow {
  id: number;
  t: string;
  kind: string;
  actor_ids: string[];
  importance: number;
  payload: Record<string, unknown>;
}

const FILTERS = ['', 'agent_', 'incident_', 'company_', 'group_', 'order_', 'trade_', 'news_'];

export default function FeedPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      fetchEvents()
        .then((r) => setEvents(r.events ?? []))
        .catch((e) => setError((e as Error).message));
    tick();
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, []);

  const visible = filter ? events.filter((e) => e.kind.includes(filter)) : events;

  return (
    <PageChrome title="World Feed" eyebrow="persistent event firehose">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {FILTERS.map((value) => (
          <button
            key={value || 'all'}
            onClick={() => setFilter(value)}
            className={`chip ${filter === value ? 'active' : ''}`}
            style={{ border: 0 }}
          >
            {value || 'all'}
          </button>
        ))}
      </div>
      {error && <EmptyState>{error}</EmptyState>}
      {!error && visible.length === 0 && <EmptyState>No events yet. The city is waking up.</EmptyState>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.slice(0, 100).map((e) => (
          <Panel key={e.id} style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div className="pixel" style={{ fontSize: 10, color: '#8a8478', letterSpacing: '0.16em' }}>
                  {e.kind.toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#ece6d3', marginTop: 4, lineHeight: 1.4 }}>
                  {eventText(e.kind, e.payload)}
                </div>
                {e.actor_ids[0] && (
                  <Link
                    href={`/agent/${e.actor_ids[0]}`}
                    className="mono"
                    style={{
                      marginTop: 6,
                      display: 'inline-block',
                      fontSize: 11,
                      color: '#ffc26b',
                      textDecoration: 'underline dotted',
                    }}
                  >
                    open primary actor →
                  </Link>
                )}
              </div>
              <div className="mono" style={{ fontSize: 10, color: '#5e5868', textAlign: 'right', flexShrink: 0 }}>
                <div>{timeLabel(e.t)}</div>
                <div>importance {e.importance}</div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </PageChrome>
  );
}
