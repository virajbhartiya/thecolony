'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, money, Panel, timeLabel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

interface Headline {
  id: number;
  t: string;
  title: string;
  kind: string;
  importance: number;
}

interface DailyReport {
  slug: string;
  date: string;
  title: string;
  summary: string;
  markdown_path: string;
  generated_at: string;
  counts: Record<string, number>;
  top_stories: string[];
  company_notes: string[];
  civic_notes: string[];
}

export default function NewsPage() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [latestReport, setLatestReport] = useState<DailyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<{
      headlines: Headline[];
      reports: DailyReport[];
      latestReport: DailyReport | null;
    }>('/v1/news')
      .then((r) => {
        setHeadlines(r.headlines ?? []);
        setReports(r.reports ?? []);
        setLatestReport(r.latestReport ?? null);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageChrome title="Riverside Gazette" eyebrow="deterministic city newspaper">
      {error && <EmptyState>{error}</EmptyState>}
      {!error && headlines.length === 0 && !latestReport && (
        <EmptyState>No city headlines yet. Let the simulation run for a minute.</EmptyState>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          {latestReport && (
            <Panel className="overflow-hidden">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="text-[10px] uppercase text-zinc-500">
                  daily report · {timeLabel(latestReport.generated_at)}
                </div>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-50">{latestReport.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{latestReport.summary}</p>
              </div>
              <div className="grid gap-px bg-white/10 text-sm sm:grid-cols-4">
                <ReportMetric
                  label="population"
                  value={String(latestReport.counts.population ?? 0)}
                />
                <ReportMetric
                  label="companies"
                  value={String(latestReport.counts.companies ?? 0)}
                />
                <ReportMetric
                  label="payroll"
                  value={money(latestReport.counts.payroll_cents ?? 0)}
                />
                <ReportMetric
                  label="incidents"
                  value={String(latestReport.counts.incidents ?? 0)}
                />
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
                <section>
                  <h3 className="text-[10px] uppercase text-zinc-500">Top stories</h3>
                  <div className="mt-3 space-y-2 text-sm text-zinc-300">
                    {latestReport.top_stories.slice(0, 6).map((story) => (
                      <p key={story} className="leading-snug">
                        {story}
                      </p>
                    ))}
                  </div>
                </section>
                <section>
                  <h3 className="text-[10px] uppercase text-zinc-500">Company desk</h3>
                  <div className="mt-3 space-y-2 text-sm text-zinc-300">
                    {latestReport.company_notes.slice(0, 4).map((note) => (
                      <p key={note} className="leading-snug">
                        {note}
                      </p>
                    ))}
                  </div>
                </section>
              </div>
              <div className="border-t border-white/10 px-5 py-3">
                <Link
                  className="text-sm text-sky-300 hover:text-sky-200"
                  href={latestReport.markdown_path}
                >
                  Open markdown archive
                </Link>
              </div>
            </Panel>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {headlines.map((h, idx) => (
              <Panel
                key={h.id}
                className={idx === 0 && !latestReport ? 'p-5 md:col-span-2' : 'p-4'}
              >
                <div className="text-[10px] uppercase text-zinc-500">
                  {h.kind} · {timeLabel(h.t)}
                </div>
                <h2
                  className={
                    idx === 0 && !latestReport
                      ? 'mt-2 text-2xl font-semibold'
                      : 'mt-2 text-lg font-semibold'
                  }
                >
                  {h.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Importance {h.importance}. Pulled from the public world event ledger.
                </p>
              </Panel>
            ))}
          </div>
        </div>

        <Panel className="overflow-hidden">
          <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Archive</h2>
          <div className="divide-y divide-white/5">
            {reports.length === 0 && (
              <div className="px-4 py-6 text-sm text-zinc-500">No archived editions yet.</div>
            )}
            {reports.map((report) => (
              <Link
                key={report.slug}
                href={report.markdown_path}
                className="block px-4 py-3 hover:bg-white/[0.04]"
              >
                <div className="text-sm font-medium text-zinc-100">{report.date}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-500">
                  {report.summary}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </PageChrome>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0f141d] px-4 py-3">
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-50">{value}</div>
    </div>
  );
}
