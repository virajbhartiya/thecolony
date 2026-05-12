import { z } from 'zod';

export const TraitsSchema = z.object({
  openness: z.number().min(0).max(1),
  conscientiousness: z.number().min(0).max(1),
  extraversion: z.number().min(0).max(1),
  agreeableness: z.number().min(0).max(1),
  neuroticism: z.number().min(0).max(1),
  greed: z.number().min(0).max(1),
  risk: z.number().min(0).max(1),
  empathy: z.number().min(0).max(1),
  ambition: z.number().min(0).max(1),
  sociability: z.number().min(0).max(1),
  paranoia: z.number().min(0).max(1),
  ideology_lean: z.number().min(-1).max(1),
});
export type Traits = z.infer<typeof TraitsSchema>;

export const NeedsSchema = z.object({
  hunger: z.number().min(0).max(100),
  energy: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
  money_anxiety: z.number().min(0).max(100),
  life_satisfaction: z.number().min(0).max(100),
});
export type Needs = z.infer<typeof NeedsSchema>;

export const AgentStatus = z.enum(['alive', 'jailed', 'bankrupt', 'dead']);
export type AgentStatus = z.infer<typeof AgentStatus>;

export const AgentStateKind = z.enum([
  'idle',
  'walking',
  'working',
  'sleeping',
  'eating',
  'speaking',
  'jailed',
  'dead',
]);
export type AgentStateKind = z.infer<typeof AgentStateKind>;

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  born_at: z.string(),
  died_at: z.string().nullable(),
  age_years: z.number().int(),
  traits: TraitsSchema,
  needs: NeedsSchema,
  occupation: z.string().nullable(),
  employer_id: z.string().uuid().nullable(),
  home_id: z.string().uuid().nullable(),
  balance_cents: z.number().int(),
  status: AgentStatus,
  portrait_seed: z.string(),
  pos_x: z.number(),
  pos_y: z.number(),
  target_x: z.number(),
  target_y: z.number(),
  state: AgentStateKind,
});
export type Agent = z.infer<typeof AgentSchema>;
