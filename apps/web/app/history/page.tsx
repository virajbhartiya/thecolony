'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, Panel, timeLabel } from '../../components/PageChrome';
import { eventText } from '../../components/EventText';
import { fetchEndpoint } from '../../lib/api';

interface Death { agent_id: string; name: string | null; t: string; cause: string; eulogy: string | null }
interface TimelineEvent { id: number; t: string; kind: string; actor_ids: string[]; importance: number; payload: Record<string, unknown> }

export default function HistoryPage() {
  const [data, setData] = useState<{ deaths: Death[]; timeline: TimelineEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<{ deaths: Death[]; timeline: TimelineEvent[] }>('/v1/history')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageChrome title="History" eyebrow="important events and obituaries">
      {error && <EmptyState>{error}</EmptyState>}
      {!data && !error && <EmptyState>Loading city history...</EmptyState>}
      {data && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Panel className="p-4">
            <h2 className="text-sm font-semibold">Obituaries</h2>
            {data.deaths.length === 0 && <p className="mt-3 text-sm text-zinc-500">No deaths yet. The city remembers forever when they happen.</p>}
            <div className="mt-3 space-y-3">
              {data.deaths.map((d) => (
                <div key={d.agent_id} className="border-t border-white/10 pt-3">
                  <Link href={`/agent/${d.agent_id}`} className="font-medium text-zinc-100">{d.name ?? 'Unknown citizen'}</Link>
                  <div className="text-xs text-zinc-500">{d.cause} · {timeLabel(d.t)}</div>
                  <p className="mt-1 text-sm text-zinc-400">{d.eulogy ?? 'No eulogy written yet.'}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="overflow-hidden">
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Timeline</h2>
            <div className="divide-y divide-white/5">
              {data.timeline.map((e) => (
                <div key={e.id} className="px-4 py-3 text-sm">
                  <div className="text-xs uppercase text-zinc-500">{e.kind} · {timeLabel(e.t)}</div>
                  <div className="mt-1">{eventText(e.kind, e.payload)}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </PageChrome>
  );
}
