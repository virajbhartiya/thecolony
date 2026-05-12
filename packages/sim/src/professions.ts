import type { Traits } from '@thecolony/domain';

export interface ProfessionProfile {
  key: string;
  title: string;
  role: string;
  industries: string[];
  starting_cash_cents: number;
  wage_cents: number;
  skill_tags: string[];
  trait_bias: Partial<Record<keyof Traits, number>>;
}

export const PROFESSIONS: ProfessionProfile[] = [
  {
    key: 'chef',
    title: 'Chef',
    role: 'kitchen lead',
    industries: ['bar', 'shop', 'farm'],
    starting_cash_cents: 8500,
    wage_cents: 1900,
    skill_tags: ['food', 'service', 'supply'],
    trait_bias: { conscientiousness: 0.08, sociability: 0.08, empathy: 0.04 },
  },
  {
    key: 'builder',
    title: 'Builder',
    role: 'builder',
    industries: ['factory', 'town_hall'],
    starting_cash_cents: 7800,
    wage_cents: 2100,
    skill_tags: ['construction', 'repairs', 'tools'],
    trait_bias: { conscientiousness: 0.1, ambition: 0.05, risk: 0.02 },
  },
  {
    key: 'stock_broker',
    title: 'Stock Broker',
    role: 'broker',
    industries: ['bank', 'office'],
    starting_cash_cents: 18000,
    wage_cents: 2800,
    skill_tags: ['markets', 'credit', 'risk'],
    trait_bias: { greed: 0.16, ambition: 0.12, risk: 0.12, empathy: -0.05 },
  },
  {
    key: 'shopkeeper',
    title: 'Shopkeeper',
    role: 'merchant',
    industries: ['shop'],
    starting_cash_cents: 11500,
    wage_cents: 2200,
    skill_tags: ['retail', 'pricing', 'inventory'],
    trait_bias: { sociability: 0.1, conscientiousness: 0.08, greed: 0.05 },
  },
  {
    key: 'farmer',
    title: 'Farmer',
    role: 'grower',
    industries: ['farm'],
    starting_cash_cents: 6500,
    wage_cents: 1700,
    skill_tags: ['food', 'land', 'weather'],
    trait_bias: { conscientiousness: 0.1, neuroticism: -0.05, empathy: 0.04 },
  },
  {
    key: 'engineer',
    title: 'Engineer',
    role: 'engineer',
    industries: ['water_works', 'power_plant', 'factory'],
    starting_cash_cents: 10500,
    wage_cents: 2400,
    skill_tags: ['utilities', 'systems', 'maintenance'],
    trait_bias: { openness: 0.08, conscientiousness: 0.12, sociability: -0.04 },
  },
  {
    key: 'civil_servant',
    title: 'Civil Servant',
    role: 'clerk',
    industries: ['town_hall', 'court'],
    starting_cash_cents: 9200,
    wage_cents: 2000,
    skill_tags: ['permits', 'law', 'taxes'],
    trait_bias: { conscientiousness: 0.12, agreeableness: 0.05, risk: -0.04 },
  },
  {
    key: 'bartender',
    title: 'Bartender',
    role: 'bartender',
    industries: ['bar'],
    starting_cash_cents: 7600,
    wage_cents: 1800,
    skill_tags: ['service', 'rumors', 'nightlife'],
    trait_bias: { extraversion: 0.12, sociability: 0.14, paranoia: 0.03 },
  },
  {
    key: 'guard',
    title: 'Guard',
    role: 'guard',
    industries: ['jail', 'court', 'bank'],
    starting_cash_cents: 8200,
    wage_cents: 2000,
    skill_tags: ['security', 'force', 'witnessing'],
    trait_bias: { risk: 0.08, conscientiousness: 0.07, empathy: -0.03 },
  },
  {
    key: 'artist',
    title: 'Artist',
    role: 'artist',
    industries: ['temple', 'bar', 'office'],
    starting_cash_cents: 5600,
    wage_cents: 1500,
    skill_tags: ['culture', 'persuasion', 'status'],
    trait_bias: { openness: 0.18, sociability: 0.08, conscientiousness: -0.04 },
  },
];

export function pickProfession(index: number, rng: () => number): ProfessionProfile {
  if (index < PROFESSIONS.length) return PROFESSIONS[index]!;
  return PROFESSIONS[Math.floor(rng() * PROFESSIONS.length)]!;
}

export function professionByTitle(title: string | null | undefined): ProfessionProfile | null {
  if (!title) return null;
  const normalized = title.toLowerCase();
  return PROFESSIONS.find((p) => normalized.includes(p.title.toLowerCase())) ?? null;
}

export function applyProfessionBias(traits: Traits, profile: ProfessionProfile): Traits {
  const next = { ...traits };
  for (const [key, delta] of Object.entries(profile.trait_bias) as Array<[keyof Traits, number]>) {
    next[key] = clamp01(next[key] + delta);
  }
  return next;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
