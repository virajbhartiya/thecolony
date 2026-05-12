import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { db, schema } from '@thecolony/db';
import { desc, like, sql } from 'drizzle-orm';
import { writeEvent } from './event-writer';

interface DailyReport {
  slug: string;
  date: string;
  title: string;
  summary: string;
  markdown_path: string;
  generated_at: string;
  counts: {
    population: number;
    companies: number;
    workers: number;
    births: number;
    deaths: number;
    incidents: number;
    trades: number;
    payroll_cents: number;
    rent_cents: number;
    taxes_cents: number;
    gdp_cents: number;
    treasury_cents: number;
  };
  top_stories: string[];
  company_notes: string[];
  civic_notes: string[];
  markdown: string;
}

export async function generateDailyReport({ force = false, at = new Date() } = {}): Promise<{
  created: boolean;
  report: DailyReport;
} | null> {
  const day = at.toISOString().slice(0, 10);
  const key = `daily_report:${day}`;
  const existing = await db
    .select()
    .from(schema.city_state)
    .where(sql`${schema.city_state.key} = ${key}`)
    .limit(1);
  if (existing[0] && !force) {
    const report = existing[0].value as DailyReport;
    await writeArchive(report);
    return { created: false, report };
  }

  const since = new Date(at.getTime() - 24 * 60 * 60_000);
  const report = await buildReport(day, at, since);
  await db
    .insert(schema.city_state)
    .values({ key, value: report })
    .onConflictDoUpdate({
      target: schema.city_state.key,
      set: { value: report, updated_at: new Date() },
    });
  await writeArchive(report);

  const previousHeadline = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
    FROM ${schema.world_event}
    WHERE kind = 'news_headline'
      AND payload->>'slug' = ${report.slug}
  `);
  if (Number(previousHeadline[0]?.n ?? 0) === 0) {
    await writeEvent({
      kind: 'news_headline',
      actor_ids: [],
      importance: 8,
      payload: {
        slug: report.slug,
        title: report.title,
        summary: report.summary,
        markdown_path: report.markdown_path,
      },
    });
  }

  return { created: true, report };
}

export async function listDailyReports(limit = 20): Promise<DailyReport[]> {
  const rows = await db
    .select({ value: schema.city_state.value })
    .from(schema.city_state)
    .where(like(schema.city_state.key, 'daily_report:%'))
    .orderBy(desc(schema.city_state.updated_at))
    .limit(limit);
  return rows.map((row) => row.value as DailyReport);
}

async function buildReport(day: string, at: Date, since: Date): Promise<DailyReport> {
  const sinceIso = since.toISOString();
  const events = await db.execute<{
    kind: string;
    t: string;
    importance: number;
    payload: Record<string, unknown>;
  }>(sql`
    SELECT kind, t, importance, payload
    FROM ${schema.world_event}
    WHERE t >= ${sinceIso}::timestamptz
      AND kind <> 'news_headline'
    ORDER BY importance DESC, t DESC
    LIMIT 80
  `);

  const [city] = await db.execute<{
    population: number;
    companies: number;
    workers: number;
    gdp_cents: number;
    treasury_cents: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM ${schema.agent} WHERE status <> 'dead') AS population,
      (SELECT COUNT(*)::int FROM ${schema.company} WHERE dissolved_at IS NULL AND building_id IS NOT NULL) AS companies,
      (SELECT COUNT(*)::int FROM ${schema.job} WHERE ended_at IS NULL) AS workers,
      (
        (SELECT COALESCE(SUM(balance_cents)::bigint, 0)::bigint FROM ${schema.agent} WHERE status <> 'dead') +
        (SELECT COALESCE(SUM(treasury_cents)::bigint, 0)::bigint FROM ${schema.company} WHERE dissolved_at IS NULL)
      )::bigint AS gdp_cents,
      COALESCE((SELECT (value->>'treasury_cents')::bigint FROM ${schema.city_state} WHERE key = 'government'), 0)::bigint AS treasury_cents
  `);

  const [flow] = await db.execute<{
    payroll_cents: number;
    rent_cents: number;
    taxes_cents: number;
    trades: number;
  }>(sql`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE reason = 'wage'), 0)::bigint AS payroll_cents,
      COALESCE(SUM(amount_cents) FILTER (WHERE reason = 'rent'), 0)::bigint AS rent_cents,
      COALESCE(SUM(amount_cents) FILTER (WHERE reason = 'city_tax'), 0)::bigint AS taxes_cents,
      COALESCE(COUNT(*) FILTER (WHERE reason = 'share_trade'), 0)::int AS trades
    FROM ${schema.ledger_entry}
    WHERE t >= ${sinceIso}::timestamptz
  `);

  const [life] = await db.execute<{
    births: number;
    deaths: number;
    incidents: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM ${schema.birth_event} WHERE t >= ${sinceIso}::timestamptz) AS births,
      (SELECT COUNT(*)::int FROM ${schema.death_event} WHERE t >= ${sinceIso}::timestamptz) AS deaths,
      (SELECT COUNT(*)::int FROM ${schema.incident} WHERE t >= ${sinceIso}::timestamptz) AS incidents
  `);

  const companies = await db.execute<{
    name: string;
    industry: string | null;
    workers: number;
    treasury_cents: number;
  }>(sql`
    SELECT c.name, c.industry, COUNT(j.id)::int AS workers, c.treasury_cents
    FROM ${schema.company} c
    LEFT JOIN ${schema.job} j ON j.company_id = c.id AND j.ended_at IS NULL
    WHERE c.dissolved_at IS NULL AND c.building_id IS NOT NULL
    GROUP BY c.id, c.name, c.industry, c.treasury_cents
    ORDER BY workers DESC, c.treasury_cents DESC, c.name
    LIMIT 6
  `);

  const civic = await db.execute<{
    name: string;
    status: string;
    occupation: string | null;
    warrants: number;
    bounty_cents: number;
  }>(sql`
    SELECT a.name, a.status, a.occupation, COALESCE(l.warrants, 0)::int AS warrants, COALESCE(l.bounty_cents, 0)::bigint AS bounty_cents
    FROM ${schema.agent} a
    LEFT JOIN ${schema.legal_status} l ON l.agent_id = a.id
    WHERE a.status <> 'dead'
    ORDER BY COALESCE(l.warrants, 0) DESC, a.balance_cents DESC, a.name
    LIMIT 5
  `);

  const counts = {
    population: Number(city?.population ?? 0),
    companies: Number(city?.companies ?? 0),
    workers: Number(city?.workers ?? 0),
    births: Number(life?.births ?? 0),
    deaths: Number(life?.deaths ?? 0),
    incidents: Number(life?.incidents ?? 0),
    trades: Number(flow?.trades ?? 0),
    payroll_cents: Number(flow?.payroll_cents ?? 0),
    rent_cents: Number(flow?.rent_cents ?? 0),
    taxes_cents: Number(flow?.taxes_cents ?? 0),
    gdp_cents: Number(city?.gdp_cents ?? 0),
    treasury_cents: Number(city?.treasury_cents ?? 0),
  };

  const companyNotes = companies.map(
    (company) =>
      `${company.name} (${company.industry ?? 'local'}) employed ${company.workers} and held ${money(company.treasury_cents)} in treasury.`,
  );
  const civicNotes = civic.map((agent) => {
    const legal = agent.warrants > 0 ? `, ${agent.warrants} warrants` : '';
    const bounty = Number(agent.bounty_cents) > 0 ? `, ${money(agent.bounty_cents)} bounty` : '';
    return `${agent.name}, ${agent.occupation ?? 'unassigned'}, was ${agent.status}${legal}${bounty}.`;
  });
  const eventStories: string[] = [];
  let shareStories = 0;
  for (const event of events) {
    if (event.kind === 'shares_issued') {
      shareStories++;
      if (shareStories > 2) continue;
    }
    eventStories.push(titleForEvent(event.kind, event.payload));
  }
  const topStories = uniqueStories(eventStories, companyNotes).slice(0, 8);

  const lead = leadSentence(counts, topStories);
  const title = `Yesterday in TheColony - ${day}`;
  const slug = `${day}-daily-report`;
  const markdownPath = `/news/reports/${slug}.md`;
  const markdown = [
    `# ${title}`,
    ``,
    `Generated: ${at.toISOString()}`,
    ``,
    lead,
    ``,
    `## Scoreboard`,
    ``,
    `- Population: ${counts.population}`,
    `- Companies: ${counts.companies}`,
    `- Active jobs: ${counts.workers}`,
    `- GDP: ${money(counts.gdp_cents)}`,
    `- City treasury: ${money(counts.treasury_cents)}`,
    `- Payroll cleared: ${money(counts.payroll_cents)}`,
    `- Rent paid: ${money(counts.rent_cents)}`,
    `- Taxes collected: ${money(counts.taxes_cents)}`,
    `- Births: ${counts.births}`,
    `- Deaths: ${counts.deaths}`,
    `- Incidents: ${counts.incidents}`,
    `- Share trades: ${counts.trades}`,
    ``,
    `## Top Stories`,
    ``,
    ...(topStories.length
      ? topStories.map((story) => `- ${story}`)
      : ['- The city produced no major public events in this window.']),
    ``,
    `## Companies`,
    ``,
    ...(companyNotes.length
      ? companyNotes.map((note) => `- ${note}`)
      : ['- No active companies reported payroll.']),
    ``,
    `## Civic Watch`,
    ``,
    ...(civicNotes.length
      ? civicNotes.map((note) => `- ${note}`)
      : ['- No civic records changed.']),
    ``,
  ].join('\n');

  return {
    slug,
    date: day,
    title,
    summary: lead,
    markdown_path: markdownPath,
    generated_at: at.toISOString(),
    counts,
    top_stories: topStories,
    company_notes: companyNotes,
    civic_notes: civicNotes,
    markdown,
  };
}

async function writeArchive(report: DailyReport): Promise<void> {
  const archiveDir = resolve(repoRoot(), 'apps/web/public/news/reports');
  await mkdir(archiveDir, { recursive: true });
  await writeFile(resolve(archiveDir, `${report.slug}.md`), report.markdown, 'utf8');
}

function repoRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(resolve(dir, 'SPEC.md')) && existsSync(resolve(dir, 'TODO.md'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

function leadSentence(counts: DailyReport['counts'], topStories: string[]): string {
  const first = topStories[0] ?? 'The city stayed open for business';
  return `${first}. The ledger closed with ${counts.population} citizens, ${counts.companies} companies, ${money(
    counts.payroll_cents,
  )} in payroll, ${counts.births} births, ${counts.deaths} deaths, and ${counts.incidents} reported incidents.`;
}

function titleForEvent(kind: string, payload: Record<string, unknown>): string {
  switch (kind) {
    case 'city_founded':
      return `TheColony opened with ${String(payload.mayor_name ?? 'an interim mayor')} at City Hall`;
    case 'mayor_elected':
      return `${String(payload.mayor_name ?? 'A candidate')} won City Hall`;
    case 'city_tax_collected':
      return `City Hall collected ${money(payload.amount_cents)} from taxpayers`;
    case 'city_aid_paid':
      return `City Hall paid ${money(payload.amount_cents)} in public aid`;
    case 'company_founded':
      return `${String(payload.name ?? 'A company')} opened for business`;
    case 'shares_issued':
      return `${String(payload.ticker ?? payload.company ?? 'A company')} opened its founding share book`;
    case 'order_placed':
      return `${String(payload.ticker ?? payload.asset ?? 'Shares')} drew a ${String(payload.side ?? 'market')} order at ${money(
        payload.price_cents,
      )}`;
    case 'job_posted':
      return `${String(payload.company ?? 'A company')} posted ${String(payload.openings ?? '?')} ${String(payload.role ?? 'worker')} openings`;
    case 'agent_hired':
      return `${String(payload.company ?? 'A company')} hired a ${String(payload.role ?? 'worker')}`;
    case 'agent_commuted':
      return `${String(payload.role ?? 'A worker')} headed to ${String(payload.building ?? payload.company ?? 'work')}`;
    case 'agent_worked':
      return `${String(payload.role ?? 'A worker')} worked at ${String(payload.company ?? 'a company')}`;
    case 'agent_evicted':
      return `A tenant was evicted over ${money(payload.rent)} daily rent`;
    case 'agent_died':
      return `${String(payload.name ?? 'A citizen')} died from ${String(payload.cause ?? 'unknown causes')}`;
    case 'birth':
      return `${String(payload.name ?? 'A new citizen')} entered civic life`;
    case 'incident_theft':
      return `Theft report: ${money(payload.amount_cents)} stolen`;
    case 'incident_assault':
      return `Assault report with severity ${String(payload.severity ?? '?')}`;
    case 'incident_fraud':
      return `Fraud report: ${money(payload.amount_cents)} diverted`;
    case 'court_verdict':
      return `${payload.guilty ? 'Guilty' : 'Not guilty'} verdict in ${String(payload.charge ?? 'case')}`;
    case 'bounty_paid':
      return `City Hall paid a ${money(payload.amount_cents)} bounty`;
    case 'group_founded':
      return `${String(payload.name ?? 'A faction')} formed as a ${String(payload.kind ?? 'group')}`;
    case 'trade_executed':
      return `${String(payload.ticker ?? payload.asset ?? 'Shares')} traded at ${money(payload.price_cents)}`;
    default:
      return kind.replaceAll('_', ' ');
  }
}

function uniqueStories(stories: string[], fallback: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const story of stories) {
    if (seen.has(story)) continue;
    seen.add(story);
    out.push(story);
  }
  for (const story of fallback) {
    if (out.length >= 8) break;
    if (!seen.has(story)) out.push(story);
  }
  return out;
}

function money(value: unknown): string {
  return `$${(Number(value ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
