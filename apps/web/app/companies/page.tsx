'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageChrome, { EmptyState, money, Panel, timeLabel } from '../../components/PageChrome';
import { fetchEndpoint } from '../../lib/api';

interface Company {
  id: string;
  name: string;
  industry: string | null;
  ticker: string | null;
  treasury_cents: number;
  founder_id: string | null;
  founder_name: string | null;
  building_id: string | null;
  building_name: string | null;
  building_kind: string | null;
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

export default function CompaniesPage() {
  const [data, setData] = useState<CompaniesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoint<CompaniesData>('/v1/companies')
      .then(setData)
      .catch((e) => setError((e as Error).message));
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

  const summary = useMemo(() => {
    const companies = data?.companies ?? [];
    const mix = data?.professionMix ?? [];
    return {
      companies: companies.length,
      workers: companies.reduce((sum, c) => sum + Number(c.workers), 0),
      payroll: companies.reduce((sum, c) => sum + Number(c.payroll_cents), 0),
      unemployed: mix.reduce((sum, p) => sum + Number(p.unemployed), 0),
    };
  }, [data]);

  return (
    <PageChrome title="Companies" eyebrow="workplaces, payroll, jobs, ownership">
      {error && <EmptyState>{error}</EmptyState>}
      {!data && !error && <EmptyState>Loading companies...</EmptyState>}
      {data && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="operating companies" value={summary.companies.toLocaleString()} />
            <Metric label="active workers" value={summary.workers.toLocaleString()} />
            <Metric label="daily payroll" value={money(summary.payroll)} />
            <Metric label="available labor" value={summary.unemployed.toLocaleString()} tone={summary.unemployed > 0 ? 'warn' : 'neutral'} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.5fr_0.8fr]">
            <Panel className="overflow-hidden">
              <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">City employers</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-zinc-500">
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-2">Company</th>
                      <th className="px-4 py-2">Workplace</th>
                      <th className="px-4 py-2">Founder</th>
                      <th className="px-4 py-2 text-right">Workers</th>
                      <th className="px-4 py-2 text-right">Payroll</th>
                      <th className="px-4 py-2 text-right">Treasury</th>
                      <th className="px-4 py-2 text-right">Inventory</th>
                      <th className="px-4 py-2 text-right">Market</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.companies.map((company) => (
                      <tr key={company.id} className="border-b border-white/5 align-top">
                        <td className="px-4 py-3">
                          <div className="font-medium">{company.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(rolesByCompany.get(company.id) ?? []).slice(0, 4).map((role) => (
                              <span key={`${company.id}-${role.role}`} className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-300">
                                {role.role} {role.workers}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {company.building_id ? (
                            <Link className="text-sky-300 hover:text-sky-200" href={`/building/${company.building_id}`}>
                              {company.building_name ?? 'workplace'}
                            </Link>
                          ) : (
                            'unassigned'
                          )}
                          <div className="text-xs text-zinc-500">{company.industry ?? company.building_kind ?? 'unknown'}</div>
                        </td>
                        <td className="px-4 py-3">
                          {company.founder_id ? (
                            <Link className="text-sky-300 hover:text-sky-200" href={`/agent/${company.founder_id}`}>
                              {company.founder_name ?? 'founder'}
                            </Link>
                          ) : (
                            <span className="text-zinc-500">city-owned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{Number(company.workers)}</td>
                        <td className="px-4 py-3 text-right font-mono">{money(company.payroll_cents)}</td>
                        <td className="px-4 py-3 text-right font-mono">{money(company.treasury_cents)}</td>
                        <td className="px-4 py-3 text-right font-mono">{Number(company.inventory_qty)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-mono">{company.ticker ?? '-'}</div>
                          <div className="text-xs text-zinc-500">{company.last_price_cents ? money(company.last_price_cents) : 'no tape'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="grid gap-4">
              <Panel className="overflow-hidden">
                <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Hiring board</h2>
                <div className="divide-y divide-white/5">
                  {data.postings.length === 0 && <div className="px-4 py-6 text-sm text-zinc-500">No active openings.</div>}
                  {data.postings.map((posting) => (
                    <div key={`${posting.company_id}-${posting.role}`} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">{posting.company}</span>
                        <span className="font-mono text-emerald-300">{posting.openings}</span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">{posting.role} · {timeLabel(posting.t)}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Agent professions</h2>
                <div className="divide-y divide-white/5">
                  {data.professionMix.map((row) => {
                    const agents = Math.max(1, Number(row.agents));
                    const employedPct = Math.round((Number(row.employed) / agents) * 100);
                    return (
                      <div key={row.occupation} className="px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate">{row.occupation}</span>
                          <span className="font-mono text-xs">{row.employed}/{row.agents}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full bg-emerald-400" style={{ width: `${employedPct}%` }} />
                        </div>
                        {Number(row.unemployed) > 0 && (
                          <div className="mt-1 text-xs text-amber-300">{row.unemployed} looking for work</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </PageChrome>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warn' }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3">
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === 'warn' ? 'text-amber-300' : 'text-zinc-100'}`}>{value}</div>
    </div>
  );
}
