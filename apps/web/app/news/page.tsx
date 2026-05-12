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
  actor_ids: string[];
  location_id: string | null;
  actor_names: Array<string | null>;
  location_name: string | null;
  location_kind: string | null;
  payload: Record<string, unknown>;
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

const DESK_BY_KIND: Record<string, 'crime' | 'market' | 'society' | 'government' | 'civic'> = {
  incident_theft: 'crime',
  incident_assault: 'crime',
  incident_fraud: 'crime',
  incident_breach: 'crime',
  agent_accused: 'crime',
  agent_jailed: 'crime',
  agent_released: 'crime',
  bounty_paid: 'crime',
  court_verdict: 'crime',
  trade_executed: 'market',
  order_placed: 'market',
  shares_issued: 'market',
  company_founded: 'market',
  company_dissolved: 'market',
  agent_bankrupt: 'market',
  building_proposed: 'civic',
  building_opened: 'civic',
  mayor_elected: 'government',
  city_tax_collected: 'government',
  job_posted: 'government',
  agent_hired: 'society',
  agent_fired: 'society',
  agent_evicted: 'society',
  agent_homed: 'society',
  group_founded: 'society',
  group_joined: 'society',
  group_left: 'society',
  agent_died: 'society',
  birth: 'society',
  migrant_arrived: 'society',
  agent_broadcast: 'civic',
  news_headline: 'civic',
};

const DESK_TONE: Record<string, { tone: string; label: string }> = {
  crime: { tone: '#e2536e', label: 'CRIME & JUSTICE' },
  market: { tone: '#4ec5b8', label: 'MARKETS' },
  society: { tone: '#95b876', label: 'SOCIETY' },
  government: { tone: '#ffc26b', label: 'CITY HALL' },
  civic: { tone: '#9b7fd1', label: 'CIVIC AFFAIRS' },
};

export default function NewsPage() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [latestReport, setLatestReport] = useState<DailyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
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
    tick();
    const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, []);

  if (error) return <PageChrome title="Riverside Gazette"><EmptyState>{error}</EmptyState></PageChrome>;
  if (headlines.length === 0 && !latestReport)
    return <PageChrome title="Riverside Gazette"><EmptyState>The press is warming up…</EmptyState></PageChrome>;

  const lead = headlines.reduce<Headline | null>((acc, h) => (!acc || h.importance > acc.importance ? h : acc), null);
  const byDesk = bucketByDesk(headlines.filter((h) => h !== lead));

  return (
    <PageChrome title="Riverside Gazette" eyebrow="the city's deterministic daily">
      <div
        className="panel"
        style={{
          padding: '14px 18px',
          marginBottom: 18,
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="pixel" style={{ fontSize: 11, color: '#8a8478', letterSpacing: '0.22em' }}>
            VOL. I · NO. {Math.floor(Date.now() / 86_400_000) % 9999}
          </div>
          <div
            className="pixel"
            style={{
              fontSize: 26,
              color: '#ffc26b',
              letterSpacing: '0.06em',
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            The Riverside Gazette
          </div>
          <div className="mono" style={{ fontSize: 11, color: '#8a8478', marginTop: 4 }}>
            “All the news your city has actually made”
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {latestReport && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 18 }}>
            <Stat label="Population" value={String(latestReport.counts.population ?? 0)} accent="#ece6d3" />
            <Stat label="Companies" value={String(latestReport.counts.companies ?? 0)} accent="#4ec5b8" />
            <Stat label="Payroll" value={money(latestReport.counts.payroll_cents ?? 0)} accent="#95b876" />
            <Stat label="Incidents" value={String(latestReport.counts.incidents ?? 0)} accent="#e2536e" />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lead && <LeadStory h={lead} />}
          {(['crime', 'market', 'society', 'government', 'civic'] as const).map((desk) => {
            const items = byDesk[desk] ?? [];
            if (items.length === 0) return null;
            return <DeskSection key={desk} desk={desk} items={items.slice(0, 6)} />;
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {latestReport && (
            <Panel style={{ padding: 0, overflow: 'hidden' }}>
              <div className="panel-header">
                <span className="panel-title">▌ EDITOR'S DAILY</span>
                <span className="panel-tag">{timeLabel(latestReport.generated_at)}</span>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <h3
                  className="pixel"
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: '#ffc26b',
                    letterSpacing: '0.08em',
                    lineHeight: 1.3,
                  }}
                >
                  {latestReport.title}
                </h3>
                <p style={{ fontSize: 12, lineHeight: 1.55, color: '#cdb98a', marginTop: 8 }}>
                  {latestReport.summary}
                </p>
                {latestReport.top_stories.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      className="pixel"
                      style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em', marginBottom: 5 }}
                    >
                      EDITOR'S PICKS
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, color: '#ece6d3', lineHeight: 1.55 }}>
                      {latestReport.top_stories.slice(0, 5).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {latestReport.company_notes.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      className="pixel"
                      style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em', marginBottom: 5 }}
                    >
                      COMPANY DESK
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, color: '#cdb98a', lineHeight: 1.55 }}>
                      {latestReport.company_notes.slice(0, 4).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {latestReport.civic_notes.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      className="pixel"
                      style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em', marginBottom: 5 }}
                    >
                      CIVIC NOTES
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, color: '#cdb98a', lineHeight: 1.55 }}>
                      {latestReport.civic_notes.slice(0, 4).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Panel>
          )}

          <Panel style={{ padding: 0, overflow: 'hidden' }}>
            <div className="panel-header">
              <span className="panel-title">▌ ARCHIVE</span>
              <span className="panel-tag">past editions</span>
            </div>
            <div>
              {reports.length === 0 && (
                <div style={{ padding: '14px 12px', fontSize: 12, color: '#5e5868' }}>
                  No archived editions yet.
                </div>
              )}
              {reports.map((r) => (
                <Link
                  key={r.slug}
                  href={r.markdown_path}
                  style={{
                    display: 'block',
                    padding: '10px 14px',
                    borderBottom: '1px dashed #2a2236',
                    textDecoration: 'none',
                    color: '#ece6d3',
                  }}
                >
                  <div className="mono" style={{ fontSize: 11, color: '#ffc26b' }}>
                    {r.date}
                  </div>
                  <div style={{ fontSize: 12, color: '#cdb98a', marginTop: 2, lineHeight: 1.4 }}>
                    {r.summary}
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </PageChrome>
  );
}

function LeadStory({ h }: { h: Headline }) {
  const desk = DESK_BY_KIND[h.kind] ?? 'civic';
  const meta = DESK_TONE[desk];
  return (
    <Panel style={{ padding: '20px 22px', borderTop: `3px solid ${meta.tone}` }}>
      <div
        className="pixel"
        style={{ fontSize: 10, color: meta.tone, letterSpacing: '0.22em', marginBottom: 6 }}
      >
        ◆ LEAD STORY · {meta.label}
      </div>
      <h2
        className="pixel"
        style={{
          margin: 0,
          fontSize: 26,
          color: '#ece6d3',
          letterSpacing: '0.04em',
          lineHeight: 1.2,
          textTransform: 'none',
        }}
      >
        {h.title}
      </h2>
      <div className="mono" style={{ fontSize: 11, color: '#8a8478', marginTop: 8 }}>
        {timeLabel(h.t)} · importance {h.importance}/10 · {h.kind.replace(/_/g, ' ')}
      </div>
      <Byline h={h} />
    </Panel>
  );
}

function DeskSection({
  desk,
  items,
}: {
  desk: 'crime' | 'market' | 'society' | 'government' | 'civic';
  items: Headline[];
}) {
  const meta = DESK_TONE[desk];
  return (
    <Panel style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="panel-header"
        style={{
          background: `linear-gradient(180deg, ${meta.tone}1F, transparent)`,
          borderBottomColor: `${meta.tone}33`,
        }}
      >
        <span className="panel-title" style={{ color: meta.tone }}>
          ▌ {meta.label}
        </span>
        <span className="panel-tag">{items.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#2a2236' }}>
        {items.map((h) => (
          <article
            key={h.id}
            style={{
              background: '#14121a',
              padding: '12px 14px',
            }}
          >
            <div className="mono" style={{ fontSize: 10, color: '#8a8478' }}>
              {timeLabel(h.t)} · imp {h.importance}
            </div>
            <h3
              style={{
                margin: '4px 0 0',
                fontSize: 14,
                color: '#ece6d3',
                lineHeight: 1.35,
                fontWeight: 600,
              }}
            >
              {h.title}
            </h3>
            <Byline h={h} compact />
          </article>
        ))}
      </div>
    </Panel>
  );
}

function Byline({ h, compact }: { h: Headline; compact?: boolean }) {
  const principals = h.actor_ids.slice(0, 2);
  if (principals.length === 0 && !h.location_id) return null;
  return (
    <div
      className="mono"
      style={{ fontSize: compact ? 10 : 11, color: '#8a8478', marginTop: 6, lineHeight: 1.4 }}
    >
      {principals.map((id, i) => (
        <span key={id}>
          {i > 0 && <span style={{ color: '#5e5868' }}> · </span>}
          <Link
            href={`/agent/${id}`}
            style={{ color: '#ffc26b', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
          >
            {h.actor_names[i] ?? id.slice(0, 6)}
          </Link>
        </span>
      ))}
      {h.location_id && h.location_name && (
        <>
          {principals.length > 0 && <span style={{ color: '#5e5868' }}> · </span>}
          <Link
            href={`/building/${h.location_id}`}
            style={{ color: '#4ec5b8', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
          >
            {h.location_name}
          </Link>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
        {label.toUpperCase()}
      </div>
      <div className="mono" style={{ fontSize: 17, color: accent, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function bucketByDesk(headlines: Headline[]): Record<string, Headline[]> {
  const out: Record<string, Headline[]> = {};
  for (const h of headlines) {
    const desk = DESK_BY_KIND[h.kind] ?? 'civic';
    (out[desk] ??= []).push(h);
  }
  return out;
}
