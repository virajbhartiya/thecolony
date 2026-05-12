'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, money, Panel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

interface Company {
  id: string;
  name: string;
  industry: string | null;
  ticker: string | null;
  charter: { mission?: string; address?: string; district?: string; city_only?: boolean };
  treasury_cents: number;
  founder_id: string | null;
  founder_name: string | null;
  building_id: string | null;
  building_name: string | null;
  building_kind: string | null;
  zone_kind: string | null;
  tile_x: number | null;
  tile_y: number | null;
  capacity: number | null;
  workers: number;
  payroll_cents: number;
  inventory_qty: number;
  shares_outstanding: number;
  last_price_cents: number | null;
  open_orders: number;
}

interface RoleStat {
  company_id: string;
  role: string;
  workers: number;
  avg_wage_cents: number;
}

interface Posting {
  company_id: string;
  company: string;
  role: string;
  openings: number;
  t: string;
}

interface ProfessionMix {
  occupation: string;
  agents: number;
  employed: number;
  unemployed: number;
}

interface CompaniesData {
  companies: Company[];
  roles: RoleStat[];
  postings: Posting[];
  professionMix: ProfessionMix[];
}

const INDUSTRY_TONE: Record<string, string> = {
  shop: '#f0a347',
  bar: '#9b7fd1',
  cafe: '#4ec5b8',
  factory: '#8a8478',
  farm: '#95b876',
  power_plant: '#4ec5b8',
  water_works: '#4ec5b8',
  bank: '#ffc26b',
  office: '#cdb98a',
  restaurant: '#f0a347',
};

export default function CompaniesPage() {
  const [data, setData] = useState<CompaniesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      fetchEndpoint<CompaniesData>('/v1/companies')
        .then(setData)
        .catch((e) => setError((e as Error).message));
    tick();
    const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, []);

  const rolesByCompany = useMemo(() => {
    const map = new Map<string, RoleStat[]>();
    for (const role of data?.roles ?? []) {
      const list = map.get(role.company_id) ?? [];
      list.push(role);
      map.set(role.company_id, list);
    }
    return map;
  }, [data?.roles]);

  const postingsByCompany = useMemo(() => {
    const map = new Map<string, Posting[]>();
    for (const p of data?.postings ?? []) {
      const list = map.get(p.company_id) ?? [];
      list.push(p);
      map.set(p.company_id, list);
    }
    return map;
  }, [data?.postings]);

  const summary = useMemo(() => {
    const companies = data?.companies ?? [];
    const mix = data?.professionMix ?? [];
    const capacity = companies.reduce((sum, c) => sum + Number(c.capacity ?? 0), 0);
    return {
      companies: companies.length,
      workers: companies.reduce((sum, c) => sum + Number(c.workers), 0),
      capacity,
      payroll: companies.reduce((sum, c) => sum + Number(c.payroll_cents), 0),
      unemployed: mix.reduce((sum, p) => sum + Number(p.unemployed), 0),
      openings: (data?.postings ?? []).reduce((sum, p) => sum + Number(p.openings), 0),
    };
  }, [data]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const c of data?.companies ?? []) {
      if (c.industry) set.add(c.industry);
    }
    return Array.from(set).sort();
  }, [data?.companies]);

  const districts = useMemo(() => {
    const map = new Map<
      string,
      { name: string; companies: number; workers: number; payroll: number }
    >();
    for (const company of data?.companies ?? []) {
      const name = company.charter?.district ?? company.zone_kind ?? 'unknown';
      const row = map.get(name) ?? { name, companies: 0, workers: 0, payroll: 0 };
      row.companies += 1;
      row.workers += Number(company.workers);
      row.payroll += Number(company.payroll_cents);
      map.set(name, row);
    }
    return [...map.values()].sort((a, b) => b.workers - a.workers || b.payroll - a.payroll);
  }, [data?.companies]);

  const visibleCompanies = useMemo(() => {
    const list = (data?.companies ?? []).slice().sort((a, b) =>
      b.workers - a.workers || Number(b.payroll_cents) - Number(a.payroll_cents),
    );
    return industryFilter ? list.filter((c) => c.industry === industryFilter) : list;
  }, [data?.companies, industryFilter]);

  if (error) return <PageChrome title="Companies"><EmptyState>{error}</EmptyState></PageChrome>;
  if (!data) return <PageChrome title="Companies"><EmptyState>Loading companies…</EmptyState></PageChrome>;

  return (
    <PageChrome title="Companies" eyebrow="workplaces · payroll · jobs · ownership">
      {/* Stats strip */}
      <div
        className="panel"
        style={{
          marginBottom: 16,
          padding: '14px 18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 24,
        }}
      >
        <Stat label="Operating" value={summary.companies.toLocaleString()} accent="#ece6d3" />
        <Stat label="Active workers" value={summary.workers.toLocaleString()} accent="#95b876" />
        <Stat
          label="Filled seats"
          value={`${summary.workers}/${Math.max(summary.capacity, summary.workers)}`}
          accent="#4ec5b8"
        />
        <Stat label="Daily payroll" value={money(summary.payroll)} accent="#ffc26b" />
        <Stat label="Open postings" value={summary.openings.toLocaleString()} accent="#f0a347" />
      </div>

      {/* Industry filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        <button
          className={`chip ${industryFilter === null ? 'active' : ''}`}
          onClick={() => setIndustryFilter(null)}
          style={{ border: 0 }}
        >
          all · {data.companies.length}
        </button>
        {industries.map((ind) => {
          const count = data.companies.filter((c) => c.industry === ind).length;
          return (
            <button
              key={ind}
              className={`chip ${industryFilter === ind ? 'active' : ''}`}
              onClick={() => setIndustryFilter(ind)}
              style={{ border: 0 }}
            >
              {ind.replace(/_/g, ' ')} · {count}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 16 }}>
        {/* Company cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {visibleCompanies.length === 0 && (
            <EmptyState>No companies match that filter.</EmptyState>
          )}
          {visibleCompanies.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              roles={rolesByCompany.get(c.id) ?? []}
              postings={postingsByCompany.get(c.id) ?? []}
            />
          ))}
        </div>

        {/* Right rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel style={{ padding: 0, overflow: 'hidden' }}>
            <div className="panel-header">
              <span className="panel-title">▌ DISTRICT PAYROLL</span>
              <span className="panel-tag">{districts.length} zones</span>
            </div>
            <div>
              {districts.map((d) => (
                <div
                  key={d.name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                    padding: '10px 14px',
                    borderBottom: '1px dashed #2a2236',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: '#ece6d3' }}>{d.name}</div>
                    <div className="mono" style={{ fontSize: 10, color: '#8a8478' }}>
                      {d.companies} cos · {money(d.payroll)}/day
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: '#95b876', textAlign: 'right' }}>
                    {d.workers} workers
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {data.professionMix.length > 0 && (
            <Panel style={{ padding: 0, overflow: 'hidden' }}>
              <div className="panel-header">
                <span className="panel-title">▌ PROFESSION MIX</span>
                <span className="panel-tag">labor market</span>
              </div>
              <div>
                {data.professionMix.slice(0, 12).map((p) => (
                  <div
                    key={p.occupation}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: 8,
                      padding: '8px 14px',
                      borderBottom: '1px dashed #2a2236',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#ece6d3' }}>{p.occupation}</div>
                    <span className="mono" style={{ fontSize: 11, color: '#95b876' }}>
                      {p.employed}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: '#e2536e' }}>
                      −{p.unemployed}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {data.postings.length > 0 && (
            <Panel style={{ padding: 0, overflow: 'hidden' }}>
              <div className="panel-header">
                <span className="panel-title">▌ RECENT POSTINGS</span>
                <span className="panel-tag">{data.postings.length}</span>
              </div>
              <div>
                {data.postings.slice(0, 8).map((p, i) => (
                  <div
                    key={`${p.company_id}-${p.role}-${i}`}
                    style={{
                      padding: '8px 14px',
                      borderBottom: '1px dashed #2a2236',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#ece6d3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.company}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: '#8a8478' }}>
                        hiring {p.role}
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: 12, color: '#f0a347' }}>
                      {p.openings}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </PageChrome>
  );
}

function CompanyCard({
  company,
  roles,
  postings,
}: {
  company: Company;
  roles: RoleStat[];
  postings: Posting[];
}) {
  const tone = INDUSTRY_TONE[company.industry ?? ''] ?? '#cdb98a';
  const fillPct = company.capacity ? Math.min(100, (Number(company.workers) / Number(company.capacity)) * 100) : 0;
  const openings = postings.reduce((s, p) => s + Number(p.openings), 0);

  return (
    <Panel style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div
            className="pixel"
            style={{ fontSize: 9, color: tone, letterSpacing: '0.18em', textTransform: 'uppercase' }}
          >
            {(company.industry ?? 'business').replace(/_/g, ' ')}
          </div>
          <h3
            style={{
              margin: '4px 0 0',
              fontSize: 15,
              color: '#ece6d3',
              fontWeight: 600,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={company.name}
          >
            {company.name}
          </h3>
        </div>
        {company.ticker && (
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: '#0b0a10',
              background: tone,
              padding: '1px 6px',
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            {company.ticker}
          </span>
        )}
      </div>

      {/* workplace + founder */}
      <div className="mono" style={{ fontSize: 11, color: '#8a8478', lineHeight: 1.5 }}>
        {company.building_name ? (
          <>
            <Link href={`/building/${company.building_id}`} style={{ color: '#4ec5b8', textDecoration: 'underline dotted' }}>
              {company.building_name}
            </Link>
          </>
        ) : (
          'no fixed workplace'
        )}
        {company.founder_id && company.founder_name && (
          <>
            {' · '}
            <Link href={`/agent/${company.founder_id}`} style={{ color: '#ffc26b', textDecoration: 'underline dotted' }}>
              {company.founder_name}
            </Link>
          </>
        )}
      </div>

      {/* mission */}
      {company.charter?.mission && (
        <div
          style={{
            fontSize: 11,
            color: '#cdb98a',
            lineHeight: 1.45,
            fontStyle: 'italic',
            background: '#1c1925',
            border: '1px solid #2a2236',
            padding: '6px 8px',
          }}
        >
          “{company.charter.mission}”
        </div>
      )}

      {/* metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <Mini label="Workers" value={`${company.workers}/${company.capacity ?? '∞'}`} accent="#95b876" />
        <Mini label="Payroll" value={money(company.payroll_cents)} accent="#ffc26b" />
        <Mini label="Treasury" value={money(company.treasury_cents)} accent="#4ec5b8" />
        <Mini label="Inventory" value={String(company.inventory_qty)} accent="#cdb98a" />
      </div>

      {/* fill bar */}
      <div>
        <div className="bar">
          <i style={{ width: `${fillPct}%`, background: tone }} />
        </div>
        <div
          className="mono"
          style={{ fontSize: 9, color: '#8a8478', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}
        >
          <span>{fillPct.toFixed(0)}% staffed</span>
          {openings > 0 && <span style={{ color: '#f0a347' }}>{openings} openings</span>}
        </div>
      </div>

      {/* roles */}
      {roles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {roles.slice(0, 6).map((role) => (
            <span
              key={role.role}
              className="mono"
              style={{
                fontSize: 10,
                color: '#cdb98a',
                background: '#1c1925',
                border: '1px solid #2a2236',
                padding: '1px 5px',
              }}
              title={`${role.workers} workers · avg wage ${money(role.avg_wage_cents)}`}
            >
              {role.role} · {role.workers}
            </span>
          ))}
        </div>
      )}

      {/* market footer */}
      {company.shares_outstanding > 0 && (
        <div
          style={{
            borderTop: '1px dashed #2a2236',
            paddingTop: 6,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
          }}
        >
          <span className="mono" style={{ color: '#8a8478' }}>
            {Number(company.shares_outstanding).toLocaleString()} shares outstanding
          </span>
          <span className="mono" style={{ color: '#4ec5b8' }}>
            ${((Number(company.last_price_cents ?? 0)) / 100).toFixed(2)}
          </span>
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
        {label.toUpperCase()}
      </div>
      <div className="mono" style={{ fontSize: 22, color: accent, marginTop: 2, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ border: '1px solid #2a2236', background: '#1c1925', padding: '4px 6px' }}>
      <div className="pixel" style={{ fontSize: 8, color: '#8a8478', letterSpacing: '0.14em' }}>
        {label.toUpperCase()}
      </div>
      <div className="mono" style={{ fontSize: 12, color: accent, marginTop: 1 }}>
        {value}
      </div>
    </div>
  );
}
