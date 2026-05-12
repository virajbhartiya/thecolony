'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, Panel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

interface Group {
  id: string;
  name: string;
  kind: string;
  founder_id: string;
  founder_name: string | null;
  doctrine: string;
  member_count: number;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<{ groups: Group[] }>('/v1/groups')
      .then((r) => setGroups(r.groups ?? []))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageChrome title="Groups" eyebrow="parties, unions, cults, clubs">
      {error && <EmptyState>{error}</EmptyState>}
      {!error && groups.length === 0 && (
        <EmptyState>No formal factions yet. The tables are ready; agents will start factions as ideology and ambition mechanics deepen.</EmptyState>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((g) => (
          <Panel key={g.id} className="p-4">
            <div className="text-xs uppercase text-zinc-500">{g.kind} · {g.member_count} members</div>
            <h2 className="mt-1 text-lg font-semibold">{g.name}</h2>
            <p className="mt-2 text-sm text-zinc-400">{g.doctrine}</p>
            <Link href={`/agent/${g.founder_id}`} className="mt-3 inline-block text-xs text-sky-300">founder: {g.founder_name ?? 'unknown'}</Link>
          </Panel>
        ))}
      </div>
    </PageChrome>
  );
}
