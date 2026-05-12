import type { Traits, Needs } from '@thecolony/domain';

function rand01(rng: () => number, mean = 0.5, sd = 0.18): number {
  // Approximate normal via avg of 4 uniforms, clipped to [0,1].
  let s = 0;
  for (let i = 0; i < 4; i++) s += rng();
  const v = mean + (s / 4 - 0.5) * 2 * sd;
  return Math.max(0, Math.min(1, v));
}

export function genTraits(rng: () => number): Traits {
  return {
    openness: rand01(rng),
    conscientiousness: rand01(rng),
    extraversion: rand01(rng),
    agreeableness: rand01(rng),
    neuroticism: rand01(rng),
    greed: rand01(rng, 0.45, 0.2),
    risk: rand01(rng, 0.4, 0.22),
    empathy: rand01(rng, 0.5, 0.2),
    ambition: rand01(rng, 0.5, 0.22),
    sociability: rand01(rng, 0.55, 0.2),
    paranoia: rand01(rng, 0.35, 0.18),
    ideology_lean: rand01(rng) * 2 - 1,
  };
}

export function genStarterNeeds(): Needs {
  return {
    hunger: 30,
    energy: 80,
    social: 50,
    money_anxiety: 30,
    life_satisfaction: 60,
  };
}
