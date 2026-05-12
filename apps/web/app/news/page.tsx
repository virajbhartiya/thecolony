'use client';
import { useEffect, useState } from 'react';
import PageChrome, { EmptyState, Panel, timeLabel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

interface Headline {
  id: number;
  t: string;
  title: string;
  kind: string;
  importance: number;
}

export default function NewsPage() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<{ headlines: Headline[] }>('/v1/news')
      .then((r) => setHeadlines(r.headlines ?? []))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageChrome title="Riverside Gazette" eyebrow="deterministic city newspaper">
      {error && <EmptyState>{error}</EmptyState>}
      {!error && headlines.length === 0 && <EmptyState>No city headlines yet. Let the simulation run for a minute.</EmptyState>}
      <div className="grid gap-3 md:grid-cols-2">
        {headlines.map((h, idx) => (
          <Panel key={h.id} className={idx === 0 ? 'p-5 md:col-span-2' : 'p-4'}>
            <div className="text-[10px] uppercase text-zinc-500">{h.kind} · {timeLabel(h.t)}</div>
            <h2 className={idx === 0 ? 'mt-2 text-2xl font-semibold' : 'mt-2 text-lg font-semibold'}>{h.title}</h2>
            <p className="mt-2 text-sm text-zinc-400">Importance {h.importance}. Pulled from the public world event ledger.</p>
          </Panel>
        ))}
      </div>
    </PageChrome>
  );
}
