import type { Agent } from '@thecolony/domain';
import type { HeuristicContext } from './heuristic';

export function buildDecisionPrompt(agent: Agent, ctx: HeuristicContext): string {
  const t = agent.traits;
  const n = agent.needs;
  return [
    `You are simulating one citizen of a living city. Speak only as them.`,
    `You are NOT a helpful assistant. You are this person and you may be selfish, fearful, kind, cruel, weird.`,
    `Output exactly one chosen action as JSON matching the provided schema. Pick the action this person would choose now.`,
    ``,
    `CITIZEN: ${agent.name} (age ${agent.age_years}), ${agent.occupation ?? 'unemployed'}`,
    `TRAITS: greed=${t.greed.toFixed(2)} risk=${t.risk.toFixed(2)} empathy=${t.empathy.toFixed(2)} ambition=${t.ambition.toFixed(2)} sociability=${t.sociability.toFixed(2)} paranoia=${t.paranoia.toFixed(2)}`,
    `STATE: hunger=${n.hunger.toFixed(0)} energy=${n.energy.toFixed(0)} life_sat=${n.life_satisfaction.toFixed(0)} balance=$${(agent.balance_cents / 100).toFixed(2)}`,
    `JOB: ${ctx.has_job ? `${ctx.job_role ?? 'worker'} at ${ctx.job_company ?? 'a local company'} (${ctx.job_building ?? ctx.job_industry ?? 'in the city'}) for $${((ctx.job_wage_cents ?? 0) / 100).toFixed(0)}/day` : 'unemployed'} HOME: ${ctx.has_home ? 'has home' : 'homeless'} FOOD ON HAND: ${ctx.food_qty}`,
    `CITY RULE: the entire world is this city. Every company, job, faction, crime, friendship, and market trade is local to these streets.`,
    `BUSINESS: ${ctx.owned_company_id ? `owns company ${ctx.owned_company_id} with ${ctx.company_worker_count ?? 0} workers and $${((ctx.company_treasury_cents ?? 0) / 100).toFixed(0)} treasury` : 'does not own a company'}${ctx.hire_candidate_id ? `; nearby hire candidate ${ctx.hire_candidate_id}` : ''}${ctx.fire_candidate_id ? `; possible fire target ${ctx.fire_candidate_id}` : ''}`,
    `FACTION: ${ctx.current_group_id ? `${ctx.current_group_name} (${ctx.current_group_kind}) doctrine: ${ctx.current_group_doctrine}` : 'no group'}${
      (ctx.candidate_groups?.length ?? 0) > 0
        ? `; nearby groups: ${ctx
            .candidate_groups!.slice(0, 3)
            .map((g) => `${g.id} ${g.name} ${g.kind}`)
            .join('; ')}`
        : ''
    }`,
    `WANTED: ${ctx.wanted_agent_id ? `${ctx.wanted_agent_id} can be accused on incident ${ctx.wanted_incident_id} (${ctx.wanted_charge ?? 'case'}), bounty $${((ctx.bounty_cents ?? 0) / 100).toFixed(0)}` : 'no nearby bounties'}`,
    `MARKET: ${
      (ctx.market_assets ?? [])
        .slice(0, 4)
        .map(
          (a) =>
            `${a.ticker} ${a.asset} last=$${(a.last_price_cents / 100).toFixed(2)} ask=${a.best_ask_cents ? `$${(a.best_ask_cents / 100).toFixed(2)}` : 'none'} bid=${a.best_bid_cents ? `$${(a.best_bid_cents / 100).toFixed(2)}` : 'none'}`,
        )
        .join('; ') || 'no public shares quoted'
    }`,
    `HOLDINGS: ${
      (ctx.share_holdings ?? [])
        .slice(0, 4)
        .map((h) => `${h.asset} ${h.shares}sh`)
        .join('; ') || 'no shares'
    }`,
    ``,
    `NEARBY BUILDINGS (id - kind - name):`,
    ...ctx.buildings.slice(0, 8).map((b) => `  ${b.id} - ${b.kind} - ${b.name}`),
    ``,
    `NEARBY AGENTS:`,
    ...ctx.nearby_agents
      .slice(0, 5)
      .map((a) => `  ${a.id} - ${a.name} (affinity=${a.affinity ?? 0})`),
    ``,
    `Choose one action.`,
  ].join('\n');
}
