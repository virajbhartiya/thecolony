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

const GREETINGS = [
  'Cold day, isn’t it?',
  'Did you hear about the new shop on the river?',
  'I haven’t eaten since yesterday.',
  'Work is killing me.',
  'My landlord is a vulture.',
  'I think the mayor is hiding something.',
  'Have you tried the new bread? It’s half air.',
  'Prices are insane. We can’t go on like this.',
  'Did Mara say something about me?',
  'I had a strange dream.',
  'Listen. I have an idea. A small one. For now.',
  'Three coins. That’s all I have to my name.',
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
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

  if (isBroker && (ctx.market_assets?.length ?? 0) > 0 && rng() < 0.42) {
    const holdings = ctx.share_holdings ?? [];
    const sellable = holdings.filter((h) => h.shares >= 5);
    if (sellable.length > 0 && rng() < 0.45) {
      const holding = pick(sellable, rng);
      const asset = ctx.market_assets?.find((a) => a.company_id === holding.company_id);
      const price = Math.max(80, Math.floor((asset?.last_price_cents ?? asset?.best_ask_cents ?? 120) * (1.04 + rng() * 0.12)));
      return {
        kind: 'place_order',
        side: 'sell',
        asset: holding.asset,
        qty: Math.min(12, Math.max(1, Math.floor(holding.shares / 4))),
        price_cents: price,
      };
    }
    if (bal > 2500) {
      const asset = pick(ctx.market_assets!, rng);
      const anchor = asset.best_ask_cents ?? asset.last_price_cents ?? 120;
      const price = Math.max(50, Math.floor(anchor * (0.92 + rng() * 0.18)));
      return {
        kind: 'place_order',
        side: 'buy',
        asset: asset.asset,
        qty: Math.max(1, Math.min(10, Math.floor(bal / Math.max(price * 6, 1)))),
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
    return { kind: 'buy', item: 'food', qty: Math.min(3, Math.floor(bal / 400)), max_price_cents: 500 };
  }
  // hungry, no shop nearby → walk to one
  if (hunger > 45) {
    const shop = ctx.buildings.find((b) => b.kind === 'shop' || b.kind === 'bar');
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
    return { kind: 'speak', to: 'nearby', body: pick(GREETINGS, rng) };
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
