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

  // sleep urgent
  if (energy < 20) {
    const home = ctx.buildings.find((b) => b.id === agent.home_id);
    if (home && (agent.pos_x !== home.tile_x || agent.pos_y !== home.tile_y)) {
      return { kind: 'move', to_building_id: home.id };
    }
    return { kind: 'sleep' };
  }

  // eat urgent
  if (hunger > 70 && ctx.food_qty > 0) {
    return { kind: 'eat', food_qty: 1 };
  }
  if (hunger > 65) {
    const shop = ctx.buildings.find((b) => b.kind === 'shop');
    if (shop) return { kind: 'move', to_building_id: shop.id };
  }

  // working
  if (ctx.has_job && rng() < 0.3) {
    return { kind: 'work' };
  }
  if (!ctx.has_job && rng() < 0.15) {
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
