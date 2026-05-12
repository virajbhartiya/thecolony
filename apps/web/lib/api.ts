const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/v1/events/stream';

export interface WorldSnapshot {
  t: string;
  sim_time: string;
  speed: number;
  population: number;
  gdp_cents: number;
  government: {
    mayor_id: string | null;
    mayor_name: string | null;
    treasury_cents: number;
    tax_rate_bps: number;
    election_id: string | null;
    next_election_at: string | null;
    turnout: number | null;
  };
  width: number;
  height: number;
  buildings: Array<{
    id: string;
    kind: string;
    zone_kind: string;
    name: string;
    tile_x: number;
    tile_y: number;
    tile_w: number;
    tile_h: number;
    capacity: number;
    rent_cents: number;
    sprite_key: string;
    condition?: number;
  }>;
  agents: Array<{
    id: string;
    name: string;
    pos_x: number;
    pos_y: number;
    target_x: number;
    target_y: number;
    state: string;
    status: string;
    occupation: string | null;
    balance_cents: number;
    portrait_seed: string;
  }>;
}

export async function fetchSnapshot(): Promise<WorldSnapshot> {
  const r = await fetch(`${API_BASE}/v1/world/snapshot`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`snapshot failed: ${r.status}`);
  return r.json();
}

export async function fetchAgent(id: string) {
  const r = await fetch(`${API_BASE}/v1/agent/${id}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`agent ${id} failed: ${r.status}`);
  return r.json();
}

export async function fetchEvents() {
  const r = await fetch(`${API_BASE}/v1/events`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`events failed: ${r.status}`);
  return r.json();
}

export async function fetchEndpoint<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return r.json() as Promise<T>;
}

export const WS_ENDPOINT = WS_URL;
export const API_BASE_URL = API_BASE;
