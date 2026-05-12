import type { Action, Agent } from '@thecolony/domain';

export interface NearbyBuilding {
  id: string;
  kind: string;
  name: string;
  tile_x: number;
  tile_y: number;
}

export interface NearbyAgent {
  id: string;
  name: string;
  distance: number;
  affinity?: number;
}

export interface HeuristicContext {
  buildings: NearbyBuilding[];
  nearby_agents: NearbyAgent[];
  has_job: boolean;
  job_role?: string | null;
  job_company?: string | null;
  job_industry?: string | null;
  job_building_id?: string | null;
  job_building?: string | null;
  job_wage_cents?: number | null;
  has_home: boolean;
  food_qty: number;
  rng: () => number;
  /** Optional richer signals — keep optional so existing callers don't break. */
  nearby_rich_agent_id?: string | null;
  at_shop_id?: string | null;
  owned_company_id?: string | null;
  hire_candidate_id?: string | null;
  hire_role?: string | null;
  fire_candidate_id?: string | null;
  company_worker_count?: number;
  company_treasury_cents?: number;
  founder_pressure?: number;
  current_group_id?: string | null;
  current_group_name?: string | null;
  current_group_kind?: string | null;
  current_group_doctrine?: string | null;
  candidate_groups?: Array<{
    id: string;
    name: string;
    kind: string;
    doctrine: string;
    member_count: number;
    founder_ideology: number;
  }>;
  wanted_agent_id?: string | null;
  wanted_incident_id?: string | null;
  wanted_charge?: string | null;
  bounty_cents?: number;
  market_assets?: Array<{
    company_id: string;
    asset: string;
    ticker: string;
    last_price_cents: number;
    best_ask_cents: number | null;
    best_bid_cents: number | null;
  }>;
  share_holdings?: Array<{ company_id: string; asset: string; shares: number }>;
}

// Tiny RNG factory so the heuristic is deterministic per agent-tick if needed.
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dialogue varied by mood so 60 agents on the heuristic path don't all
// recite the same 12 lines back to back. Lines picked by `pickLine()` below.
const LINES_NEUTRAL = [
  'Cold day, isn’t it?',
  'Have you seen the river this morning?',
  'There’s a smell off the docks again.',
  'Heard anything from Old Quarter?',
  'Long line at the market today.',
  'The sky looked strange last night.',
  'Funny how nobody talks anymore.',
  'You ever notice the bell is off by a minute?',
];
const LINES_HUNGRY = [
  'I haven’t eaten since yesterday.',
  'Three coins. That’s all I have to my name.',
  'If I miss another meal I’ll start eating my belt.',
  'Bread tastes like sawdust this week.',
  'The shop owner saw me and looked away.',
];
const LINES_TIRED = [
  'Work is killing me.',
  'I’ll sleep when I’m dead. Or sooner.',
  'My back hurts in a place backs don’t hurt.',
  'I dreamed I was free. Then the bell rang.',
];
const LINES_ANGRY = [
  'My landlord is a vulture.',
  'They fired four of us and called it pruning.',
  'Someone owes me money. Someone always does.',
  'Prices are insane. We can’t go on like this.',
  'If I see Mara again I won’t hold my tongue.',
];
const LINES_PARANOID = [
  'I think the mayor is hiding something.',
  'Did Mara say something about me?',
  'They watch the bells. They always watch.',
  'I’m being followed. Don’t look.',
  'The court isn’t fair. It never was.',
];
const LINES_HOPEFUL = [
  'Listen. I have an idea. A small one. For now.',
  'I might open a stall. Just a small one.',
  'Saving every coin. You should too.',
  'Tomorrow will be different. I’ve decided.',
];
const LINES_GOSSIP = [
  'Did you hear about the new shop on the river?',
  'Have you tried the new bread? It’s half air.',
  'Theo was at the bar again. Until dawn.',
  'I saw two of them together. You know who.',
  'Otto recited a poem at the Lantern. Three left mid-line.',
  'Someone broke into the chapel. Nothing taken, oddly.',
];
const LINES_ECONOMIC = [
  'Cloth prices doubled in a week.',
  'My wages don’t reach the rent anymore.',
  'The mill is hiring. So is bankruptcy court.',
  'A new factory means new mouths. New problems.',
];

function pickLine(agent: Agent, rng: () => number): string {
  const n = agent.needs;
  const t = agent.traits;
  // Pick a bucket by current state, with some randomness.
  const r = rng();
  if (n.hunger > 65) return pick(LINES_HUNGRY, rng);
  if (n.energy < 25) return pick(LINES_TIRED, rng);
  if (t.paranoia > 0.6 && r < 0.5) return pick(LINES_PARANOID, rng);
  if (agent.balance_cents < 1000 && r < 0.5) return pick(LINES_ANGRY, rng);
  if (t.ambition > 0.6 && r < 0.35) return pick(LINES_HOPEFUL, rng);
  if (t.sociability > 0.6 && r < 0.45) return pick(LINES_GOSSIP, rng);
  if (r < 0.3) return pick(LINES_ECONOMIC, rng);
  return pick(LINES_NEUTRAL, rng);
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function groupKindFor(agent: Agent, ctx: HeuristicContext): 'cult' | 'party' | 'union' | 'club' {
  const occupation = (agent.occupation ?? '').toLowerCase();
  if (agent.traits.paranoia > 0.65 && agent.traits.sociability > 0.5) return 'cult';
  if (
    occupation.includes('builder') ||
    occupation.includes('chef') ||
    occupation.includes('farmer') ||
    ctx.has_job
  )
    return 'union';
  if (agent.traits.ambition > 0.72 || occupation.includes('civil')) return 'party';
  return 'club';
}

function groupNameFor(agent: Agent, kind: 'cult' | 'party' | 'union' | 'club'): string {
  const first = agent.name.split(' ')[0] ?? 'City';
  switch (kind) {
    case 'cult':
      return `${first}'s Signal`;
    case 'party':
      return `${first} Civic Bloc`;
    case 'union':
      return `${first} Labor League`;
    case 'club':
      return `${first} Mutual Circle`;
  }
}

export function heuristicDecide(agent: Agent, ctx: HeuristicContext): Action {
  const { rng } = ctx;
  const hunger = agent.needs.hunger;
  const energy = agent.needs.energy;
  const sociability = agent.traits.sociability;
  const greed = agent.traits.greed;
  const empathy = agent.traits.empathy;
  const risk = agent.traits.risk;
  const bal = agent.balance_cents;
  const ambition = agent.traits.ambition;
  const isBroker = (agent.occupation ?? '').toLowerCase().includes('broker');
  const occupation = (agent.occupation ?? '').toLowerCase();
  const isGuard = occupation.includes('guard') || occupation.includes('civil servant');

  if (!ctx.current_group_id && ambition > 0.62 && sociability > 0.55 && rng() < 0.1) {
    const kind = groupKindFor(agent, ctx);
    return {
      kind: 'found_group',
      kind_of: kind,
      name: groupNameFor(agent, kind),
    };
  }

  if (
    !ctx.current_group_id &&
    (ctx.candidate_groups?.length ?? 0) > 0 &&
    rng() < sociability * 0.18
  ) {
    const group = pick(ctx.candidate_groups!, rng);
    const fit = 1 - Math.min(2, Math.abs(agent.traits.ideology_lean - group.founder_ideology)) / 2;
    if (fit > 0.45 || group.member_count >= 3) return { kind: 'join_group', group_id: group.id };
  }

  if (
    ctx.current_group_id &&
    rng() < Math.max(0, (agent.traits.paranoia - agent.traits.agreeableness) * 0.05)
  ) {
    return { kind: 'leave_group', group_id: ctx.current_group_id };
  }

  if (ctx.wanted_agent_id && ctx.wanted_incident_id) {
    const bounty = ctx.bounty_cents ?? 0;
    const civicDuty = isGuard ? 0.44 : 0.08;
    const paidHunt = bounty > 0 && (bal < 4000 || greed > 0.55 || ambition > 0.65) ? 0.22 : 0;
    if (rng() < civicDuty + paidHunt) {
      return {
        kind: 'accuse',
        target_agent_id: ctx.wanted_agent_id,
        charge: ctx.wanted_charge ?? 'outstanding warrant',
        incident_id: ctx.wanted_incident_id,
      };
    }
  }

  // Speculate: any agent with a risk appetite or money sitting idle may trade.
  // Brokers do it more often; everyone else does it occasionally.
  const tradeAppetite = isBroker
    ? 0.42
    : (risk * 0.18 + ambition * 0.12 + Math.min(0.15, bal / 50_000)) * 0.6;
  if ((ctx.market_assets?.length ?? 0) > 0 && rng() < tradeAppetite) {
    const holdings = ctx.share_holdings ?? [];
    const sellable = holdings.filter((h) => h.shares >= 5);
    // Holders sometimes sell to lock in profit.
    if (sellable.length > 0 && rng() < (isBroker ? 0.45 : 0.25)) {
      const holding = pick(sellable, rng);
      const asset = ctx.market_assets?.find((a) => a.company_id === holding.company_id);
      const price = Math.max(
        80,
        Math.floor(
          (asset?.last_price_cents ?? asset?.best_ask_cents ?? 120) * (1.02 + rng() * 0.10),
        ),
      );
      return {
        kind: 'place_order',
        side: 'sell',
        asset: holding.asset,
        qty: Math.min(12, Math.max(1, Math.floor(holding.shares / 4))),
        price_cents: price,
      };
    }
    // Buy side: needs at least ~$10 to make a meaningful bid.
    if (bal > 1000) {
      const asset = pick(ctx.market_assets!, rng);
      const anchor = asset.best_ask_cents ?? asset.last_price_cents ?? 120;
      // Be slightly above the best-bid to actually clear, not below it.
      const price = Math.max(50, Math.floor(anchor * (0.96 + rng() * 0.10)));
      const maxQty = Math.max(1, Math.min(10, Math.floor(bal / Math.max(price * 4, 1))));
      return {
        kind: 'place_order',
        side: 'buy',
        asset: asset.asset,
        qty: maxQty,
        price_cents: price,
      };
    }
  }

  if (ctx.owned_company_id && ctx.hire_candidate_id && rng() < ambition * 0.45) {
    return {
      kind: 'hire',
      agent_id: ctx.hire_candidate_id,
      wage_cents: 1800 + Math.floor(ambition * 900),
      role: ctx.hire_role ?? 'worker',
    };
  }

  if (ctx.owned_company_id && ctx.fire_candidate_id && (ctx.company_worker_count ?? 0) > 2) {
    const pressure = (ctx.company_treasury_cents ?? 0) < 25_000 ? 0.35 : 0.08;
    if (rng() < pressure + greed * 0.18) {
      return { kind: 'fire', agent_id: ctx.fire_candidate_id };
    }
  }

  if (!ctx.owned_company_id && !ctx.has_job && bal > 25000 && ambition > 0.68 && rng() < 0.08) {
    return {
      kind: 'found_company',
      name: `${agent.name.split(' ')[0]} Works`,
      charter: { industry: 'office', mission: 'turn skill and rumor into money' },
      capital_cents: Math.min(15000, Math.floor(bal * 0.4)),
    };
  }

  // Propose a new building. Triggered by deep pockets + ambition. Chooses kind
  // based on what's needed (more shops if shops are crowded, etc.). For
  // simplicity weights by the agent's risk appetite.
  // Construction gate: previously (bal>12000 && ambition>0.55 && risk>0.4)
  // selected 0/60 agents in the live city. Loosen so anyone with reasonable
  // cash AND some ambition OR risk appetite occasionally breaks ground.
  if (bal > 6000 && (ambition > 0.45 || risk > 0.5) && rng() < 0.06) {
    const pool: Array<'shop' | 'bar' | 'cafe' | 'factory' | 'farm' | 'house' | 'apartment'> = [
      'shop', 'shop', 'cafe', 'bar', 'farm', 'house', 'apartment', 'factory',
    ];
    const choice = pool[Math.floor(rng() * pool.length)] ?? 'shop';
    const capital = Math.min(20000, Math.floor(bal * 0.55));
    return { kind: 'propose_building', building_kind: choice, capital_cents: capital };
  }

  // sleep urgent
  if (energy < 20) {
    const home = ctx.buildings.find((b) => b.id === agent.home_id);
    if (home && (agent.pos_x !== home.tile_x || agent.pos_y !== home.tile_y)) {
      return { kind: 'move', to_building_id: home.id };
    }
    return { kind: 'sleep' };
  }

  // eat urgent — from personal stash
  if (hunger > 60 && ctx.food_qty > 0) {
    return { kind: 'eat', food_qty: 1 };
  }
  // hungry + at a shop with money → buy food
  if (hunger > 40 && ctx.at_shop_id && bal >= 500) {
    return {
      kind: 'buy',
      item: 'food',
      qty: Math.min(3, Math.floor(bal / 400)),
      max_price_cents: 500,
    };
  }
  // hungry, no shop nearby → walk to one
  if (hunger > 45) {
    const shop = ctx.buildings.find(
      (b) => b.kind === 'shop' || b.kind === 'restaurant' || b.kind === 'farm',
    );
    if (shop) return { kind: 'move', to_building_id: shop.id };
  }

  // CRIME: any combination of broke + greedy/desperate near a wealthier target.
  // Either a broke greedy agent OR a hungry low-empathy agent will try.
  if (ctx.nearby_rich_agent_id) {
    const desperate = bal < 2000 && (greed > 0.45 || hunger > 70);
    const opportunistic = greed > 0.7 && empathy < 0.45;
    const violent = risk > 0.78 && empathy < 0.28;
    if (isBroker && greed > 0.55 && risk > 0.42 && rng() < 0.22) {
      return {
        kind: 'fraud',
        target_agent_id: ctx.nearby_rich_agent_id,
        amount_cents: 900 + Math.floor(greed * 3200),
      };
    }
    if (violent && rng() < 0.14) {
      return { kind: 'assault', target_agent_id: ctx.nearby_rich_agent_id };
    }
    if ((desperate || opportunistic) && rng() < 0.45) {
      return { kind: 'steal', target_agent_id: ctx.nearby_rich_agent_id, item_or_money: 'money' };
    }
  }

  // working
  if (ctx.has_job && rng() < 0.3) {
    return { kind: 'work' };
  }
  if (!ctx.has_job && rng() < 0.2) {
    return { kind: 'seek_job' };
  }

  // socialize
  if (ctx.nearby_agents.length > 0 && rng() < sociability * 0.7) {
    return { kind: 'speak', to: 'nearby', body: pickLine(agent, rng) };
  }

  // homeless? try to rent
  if (!ctx.has_home && rng() < 0.2) {
    const apt = ctx.buildings.find((b) => b.kind === 'apartment' || b.kind === 'house');
    if (apt) return { kind: 'rent', building_id: apt.id };
  }

  // wander
  if (rng() < 0.4 && ctx.buildings.length > 0) {
    const dest = pick(ctx.buildings, rng);
    return { kind: 'move', to_building_id: dest.id };
  }

  return { kind: 'idle' };
}
