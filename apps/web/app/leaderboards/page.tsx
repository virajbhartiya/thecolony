'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, money, Panel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

type Row = {
  id: string;
  name: string;
  occupation: string | null;
  balance_cents?: number;
  score?: number;
  warrants?: number;
  severity?: number;
  incidents?: number;
};

interface Leaderboards {
  richest: Row[];
  loved: Row[];
  hated: Row[];
  notorious: Row[];
}

export default function LeaderboardsPage() {
  const [data, setData] = useState<Leaderboards | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      fetchEndpoint<Leaderboards>('/v1/leaderboards')
        .then(setData)
        .catch((e) => setError((e as Error).message));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <PageChrome title="Leaderboards" eyebrow="wealth, reputation, notoriety">
      {error && <EmptyState>{error}</EmptyState>}
      {!data && !error && <EmptyState>Loading leaderboards…</EmptyState>}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <Board title="Richest" tag="net worth" rows={data.richest ?? []} value={(r) => money(r.balance_cents)} accent="#95b876" />
          <Board title="Most Loved" tag="aggregate affinity" rows={data.loved ?? []} value={(r) => `+${r.score ?? 0}`} accent="#95b876" />
          <Board title="Most Hated" tag="aggregate affinity" rows={data.hated ?? []} value={(r) => `${r.score ?? 0}`} accent="#e2536e" />
          <Board title="Most Notorious" tag="rap-sheet severity" rows={data.notorious ?? []} value={(r) => `${r.incidents ?? 0} crimes · sev ${r.severity ?? 0}`} accent="#9b7fd1" />
        </div>
      )}
    </PageChrome>
  );
}

function Board({
  title,
  tag,
  rows,
  value,
  accent,
}: {
  title: string;
  tag: string;
  rows: Row[];
  value: (r: Row) => string;
  accent: string;
}) {
  return (
    <Panel style={{ overflow: 'hidden' }}>
      <div className="panel-header">
        <span className="panel-title" style={{ color: '#ece6d3' }}>
          {title}
        </span>
        <span className="panel-tag">{tag}</span>
      </div>
      <div>
        {rows.length === 0 && (
          <div style={{ padding: '14px 12px', fontSize: 12, color: '#5e5868' }}>No data yet.</div>
        )}
        {rows.slice(0, 12).map((row, i) => (
          <Link
            key={row.id}
            href={`/agent/${row.id}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: 10,
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: '1px dashed #2a2236',
              textDecoration: 'none',
              color: '#ece6d3',
            }}
          >
            <span className="mono" style={{ fontSize: 10, color: '#5e5868', width: 18 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{row.name}</div>
              <div className="mono" style={{ fontSize: 10, color: '#8a8478' }}>
                {row.occupation ?? 'unassigned'}
              </div>
            </span>
            <span className="mono" style={{ fontSize: 11, color: accent, textAlign: 'right' }}>
              {value(row)}
            </span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
