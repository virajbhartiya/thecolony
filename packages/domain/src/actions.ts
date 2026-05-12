import { z } from 'zod';

export const ActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('idle') }),
  z.object({ kind: z.literal('reflect') }),
  z.object({ kind: z.literal('move'), to_building_id: z.string().uuid() }),
  z.object({ kind: z.literal('eat'), food_qty: z.number().int().positive().optional() }),
  z.object({ kind: z.literal('sleep') }),
  z.object({ kind: z.literal('work') }),
  z.object({ kind: z.literal('seek_job'), preferred_role: z.string().optional() }),
  z.object({ kind: z.literal('quit_job') }),
  z.object({
    kind: z.literal('hire'),
    agent_id: z.string().uuid(),
    wage_cents: z.number().int().positive(),
    role: z.string(),
  }),
  z.object({ kind: z.literal('fire'), agent_id: z.string().uuid() }),
  z.object({
    kind: z.literal('buy'),
    item: z.string(),
    qty: z.number().int().positive(),
    max_price_cents: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('sell'),
    item: z.string(),
    qty: z.number().int().positive(),
    min_price_cents: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('speak'),
    to: z.enum(['public', 'group', 'nearby']),
    body: z.string().max(280),
  }),
  z.object({
    kind: z.literal('dm'),
    to_agent_id: z.string().uuid(),
    body: z.string().max(280),
  }),
  z.object({
    kind: z.literal('steal'),
    target_agent_id: z.string().uuid(),
    item_or_money: z.string(),
  }),
  z.object({ kind: z.literal('assault'), target_agent_id: z.string().uuid() }),
  z.object({
    kind: z.literal('fraud'),
    target_agent_id: z.string().uuid(),
    amount_cents: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('breach'),
    counterparty_id: z.string().uuid(),
    amount_cents: z.number().int().positive(),
    terms: z.string().max(500).optional(),
  }),
  z.object({
    kind: z.literal('accuse'),
    target_agent_id: z.string().uuid(),
    charge: z.string(),
    incident_id: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal('found_company'),
    name: z.string().min(2).max(60),
    charter: z.record(z.unknown()),
    capital_cents: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('issue_shares'),
    company_id: z.string().uuid(),
    shares: z.number().int().positive(),
    price_cents: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('place_order'),
    side: z.enum(['buy', 'sell']),
    asset: z.string(),
    qty: z.number().int().positive(),
    price_cents: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('sign_contract'),
    counterparty_id: z.string().uuid(),
    terms: z.string().max(500),
    amount_cents: z.number().int(),
  }),
  z.object({ kind: z.literal('join_group'), group_id: z.string().uuid() }),
  z.object({ kind: z.literal('leave_group'), group_id: z.string().uuid() }),
  z.object({
    kind: z.literal('found_group'),
    name: z.string().min(2).max(60),
    kind_of: z.enum(['cult', 'party', 'union', 'club']),
    doctrine: z.string().max(800).optional(),
  }),
  z.object({
    kind: z.literal('broadcast'),
    body: z.string().max(400),
    cost_cents: z.number().int().nonnegative(),
  }),
  z.object({ kind: z.literal('rent'), building_id: z.string().uuid() }),
  z.object({ kind: z.literal('buy_property'), building_id: z.string().uuid() }),
  z.object({ kind: z.literal('pray') }),
  z.object({
    kind: z.literal('propose_building'),
    building_kind: z.enum(['shop', 'bar', 'cafe', 'factory', 'farm', 'house', 'apartment']),
    capital_cents: z.number().int().positive(),
  }),
]);
export type Action = z.infer<typeof ActionSchema>;

export const DecisionResultSchema = z.object({
  action: ActionSchema,
  inner_monologue: z.string().max(500).optional(),
  rationale: z.string().max(500).optional(),
});
export type DecisionResult = z.infer<typeof DecisionResultSchema>;
