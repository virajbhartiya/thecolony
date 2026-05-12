'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, Panel, timeLabel } from '../../components/PageChrome';
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
}

interface GroupEvent {
  id: number;
  t: string;
  kind: string;
  actor_ids: string[];
  payload: Record<string, unknown>;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activity, setActivity] = useState<GroupEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<{ groups: Group[]; recentActivity: GroupEvent[] }>('/v1/groups')
      .then((r) => {
        setGroups(r.groups ?? []);
        setActivity(r.recentActivity ?? []);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageChrome title="Groups" eyebrow="parties, unions, cults, clubs">
      {error && <EmptyState>{error}</EmptyState>}
      {!error && groups.length === 0 && (
        <EmptyState>No formal factions yet. Ambitious agents can now found unions, parties, clubs, and cults during normal decisions.</EmptyState>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.75fr]">
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <Panel key={g.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase text-zinc-500">{g.kind}</div>
                <div className="rounded border border-white/10 px-2 py-0.5 text-xs font-mono text-zinc-300">{g.member_count} members</div>
              </div>
              <h2 className="mt-2 text-lg font-semibold">{g.name}</h2>
              <p className="mt-2 line-clamp-4 text-sm leading-6 text-zinc-400">{g.doctrine}</p>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <Link href={`/agent/${g.founder_id}`} className="text-sky-300 hover:text-sky-200">
                  founder: {g.founder_name ?? 'unknown'}
                </Link>
                <span className="text-zinc-500">{timeLabel(g.founded_at)}</span>
              </div>
            </Panel>
          ))}
        </div>
        <Panel className="overflow-hidden">
          <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Recent faction activity</h2>
          <div className="divide-y divide-white/5">
            {activity.length === 0 && <div className="p-4 text-sm text-zinc-500">No faction events yet.</div>}
            {activity.slice(0, 18).map((event) => (
              <div key={event.id} className="px-4 py-3 text-sm">
                <div className="text-xs uppercase text-zinc-500">{event.kind} · {timeLabel(event.t)}</div>
                <div className="mt-1 text-zinc-200">{eventText(event.kind, event.payload)}</div>
                {event.actor_ids[0] && (
                  <Link href={`/agent/${event.actor_ids[0]}`} className="mt-1 inline-block text-xs text-sky-300 hover:text-sky-200">
                    open actor
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
