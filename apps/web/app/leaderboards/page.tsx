'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, money, Panel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

type AgentScore = { id: string; name: string; occupation: string | null; balance_cents?: number; score?: number; incidents?: number; severity?: number };

export default function LeaderboardsPage() {
  const [data, setData] = useState<Record<string, AgentScore[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<Record<string, AgentScore[]>>('/v1/leaderboards')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageChrome title="Leaderboards" eyebrow="wealth, reputation, notoriety">
      {error && <EmptyState>{error}</EmptyState>}
      {!data && !error && <EmptyState>Loading leaderboards...</EmptyState>}
      {data && (
        <div className="grid gap-4 lg:grid-cols-4">
          <Board title="Richest" rows={data.richest ?? []} value={(r) => money(r.balance_cents)} />
          <Board title="Most Loved" rows={data.loved ?? []} value={(r) => String(r.score ?? 0)} />
          <Board title="Most Hated" rows={data.hated ?? []} value={(r) => String(r.score ?? 0)} />
          <Board title="Most Notorious" rows={data.notorious ?? []} value={(r) => `${r.severity ?? 0} severity`} />
        </div>
      )}
    </PageChrome>
  );
}

function Board({ title, rows, value }: { title: string; rows: AgentScore[]; value: (row: AgentScore) => string }) {
  return (
    <Panel className="overflow-hidden">
      <h2 className="border-b border-white/10 px-3 py-2 text-sm font-semibold">{title}</h2>
      <div className="divide-y divide-white/5">
        {rows.length === 0 && <div className="p-3 text-xs text-zinc-500">No data yet.</div>}
        {rows.slice(0, 12).map((row, i) => (
          <Link key={`${title}-${row.id}`} href={`/agent/${row.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-white/[0.04]">
            <span className="min-w-0">
              <span className="mr-2 text-xs text-zinc-500">{i + 1}</span>
              <span className="font-medium">{row.name}</span>
              <span className="block truncate text-xs text-zinc-500">{row.occupation ?? 'unassigned'}</span>
            </span>
            <span className="shrink-0 font-mono text-xs text-zinc-300">{value(row)}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
