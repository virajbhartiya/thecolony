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

export default function FeedPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents()
      .then((r) => setEvents(r.events ?? []))
      .catch((e) => setError((e as Error).message));
  }, []);

  const visible = filter ? events.filter((e) => e.kind.includes(filter)) : events;

  return (
    <PageChrome title="World Feed" eyebrow="persistent event firehose">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['', 'agent_', 'city_', 'company_', 'incident_'].map((value) => (
          <button
            key={value || 'all'}
            onClick={() => setFilter(value)}
            className={`rounded border px-3 py-1 text-xs ${filter === value ? 'border-sky-400/60 bg-sky-500/15 text-sky-200' : 'border-white/10 bg-white/[0.035] text-zinc-300'}`}
          >
            {value || 'all'}
          </button>
        ))}
      </div>
      {error && <EmptyState>{error}</EmptyState>}
      {!error && visible.length === 0 && <EmptyState>No events yet.</EmptyState>}
      <div className="space-y-2">
        {visible.map((e) => (
          <Panel key={e.id} className="p-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase text-zinc-500">{e.kind}</div>
                <div className="mt-1 text-sm text-zinc-100">{eventText(e.kind, e.payload)}</div>
                {e.actor_ids[0] && (
                  <Link href={`/agent/${e.actor_ids[0]}`} className="mt-1 inline-block text-xs text-sky-300 hover:text-sky-200">
                    open primary actor
                  </Link>
                )}
              </div>
              <div className="shrink-0 text-right text-xs text-zinc-500">
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
