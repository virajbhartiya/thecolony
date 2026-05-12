/** Centralized palette tables + deterministic agent-from-seed helpers. */

export interface BuildingPalette {
  roof: string;
  wall: string;
  accent: string;
  elev: number;
}

const PALETTE: Record<string, BuildingPalette> = {
  factory:     { roof: '#b9722a', wall: '#7a4a25', accent: '#f0a347', elev: 70 },
  power_plant: { roof: '#5e5868', wall: '#3a3445', accent: '#4ec5b8', elev: 88 },
  water_works: { roof: '#1f7c75', wall: '#3a8a8a', accent: '#4ec5b8', elev: 52 },
  bank:        { roof: '#1f5660', wall: '#cdb98a', accent: '#f0a347', elev: 60 },
  town_hall:   { roof: '#4f7a3d', wall: '#c9c0a8', accent: '#f0a347', elev: 92 },
  court:       { roof: '#2c2630', wall: '#a8a08e', accent: '#9b7fd1', elev: 70 },
  jail:        { roof: '#3a304a', wall: '#5e5868', accent: '#e2536e', elev: 46 },
  office:      { roof: '#7a4a25', wall: '#b8a87a', accent: '#f0a347', elev: 70 },
  apartment:   { roof: '#4f7a3d', wall: '#a08a6a', accent: '#f0a347', elev: 96 },
  house_big:   { roof: '#1f7c75', wall: '#ece6d3', accent: '#b9722a', elev: 56 },
  house:       { roof: '#b9722a', wall: '#8a7a5e', accent: '#f0a347', elev: 38 },
  bar:         { roof: '#b9722a', wall: '#4a3320', accent: '#ffc26b', elev: 42 },
  shop:        { roof: '#4f7a3d', wall: '#c0a878', accent: '#f0a347', elev: 38 },
  cafe:        { roof: '#9b7fd1', wall: '#d9c8a4', accent: '#4ec5b8', elev: 38 },
  farm:        { roof: '#6e4a2a', wall: '#c6a36c', accent: '#95b876', elev: 22 },
  temple:      { roof: '#cab36a', wall: '#eae0bd', accent: '#b9722a', elev: 64 },
  park:        { roof: '#5b7a45', wall: '#5b7a45', accent: '#95b876', elev: 0 },
};

export function buildingPalette(kind: string): BuildingPalette {
  return PALETTE[kind] ?? PALETTE.house!;
}

export function shade(hex: string, amt: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---------- Agent appearance from seed -------------------------------------

const HAIR = ['#1c1925', '#332a3f', '#5e5868', '#a8a08e', '#b9722a', '#4ec5b8', '#2a1f30'];
const SKIN = ['#d8b594', '#c8a784', '#b9956a', '#8a5a3a', '#7a4e34', '#e0c4a4', '#c8a78a'];
const SHIRT = ['#8e2738', '#1f5660', '#4f7a3d', '#332a3f', '#b9722a', '#9b7fd1', '#4ec5b8', '#f0a347'];
const PANTS = ['#1c1925', '#332a3f', '#2c2630', '#7a4a25', '#3a304a', '#5e5868'];

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export interface AgentLook {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
}

export function agentLook(seed: string | null | undefined): AgentLook {
  const h = hashSeed(seed ?? 'default');
  const pick = <T>(arr: T[], off: number): T => arr[Math.abs((h >>> off) % arr.length)]!;
  return {
    hair: pick(HAIR, 0),
    skin: pick(SKIN, 5),
    shirt: pick(SHIRT, 11),
    pants: pick(PANTS, 17),
  };
}

// ---------- Day/night ------------------------------------------------------

export function nightTintForPhase(p: number): { color: string; alpha: number } {
  if (p < 0.18 || p > 0.85) return { color: '#1a2244', alpha: 0.55 };
  if (p < 0.27) return { color: '#7a4030', alpha: 0.3 };
  if (p > 0.72) return { color: '#b9522a', alpha: 0.34 };
  if (p > 0.78) return { color: '#4a2a3a', alpha: 0.45 };
  return { color: '#ffffff', alpha: 0 };
}

export function skyTopForPhase(p: number): string {
  if (p < 0.18 || p > 0.85) return '#162042';
  if (p < 0.27) return '#a55a3a';
  if (p > 0.72) return '#c46e3a';
  return '#5a7a98';
}

export function dayPhaseName(p: number): string {
  if (p < 0.18) return 'night';
  if (p < 0.30) return 'dawn';
  if (p < 0.46) return 'morning';
  if (p < 0.56) return 'noon';
  if (p < 0.70) return 'afternoon';
  if (p < 0.84) return 'dusk';
  return 'night';
}

export function isLitWindows(p: number): boolean {
  return p < 0.22 || p > 0.78;
}
