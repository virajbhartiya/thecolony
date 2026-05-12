import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { env, type Env } from '@thecolony/config';
import { ActionSchema, type Agent } from '@thecolony/domain';
import { z } from 'zod';
import type { DecisionInput, DecisionOutput } from './decide';

const DecisionResponseSchema = z.object({
  action: ActionSchema,
  inner_monologue: z.string().max(280).optional(),
  rationale: z.string().max(280).optional(),
});

type DecisionProvider = 'openai' | 'google';

interface ModelRef {
  provider: DecisionProvider;
  model: string;
  id: string;
}

export async function providerDecide(input: DecisionInput): Promise<DecisionOutput> {
  const e = env();
  const selected = chooseDecisionModel(input.importance ?? 3, e);
  if (!selected) throw new Error('No configured LLM provider has an API key');

  const prompt = buildPrompt(input.agent, input.context);
  const result = await generateObject({
    model: modelFor(selected, e),
    schema: DecisionResponseSchema,
    prompt,
    temperature: 0.9,
    maxRetries: 1,
  });

  return {
    action: result.object.action,
    source: 'llm',
    model: selected.id,
    rationale: result.object.rationale,
    inner_monologue: result.object.inner_monologue,
  };
}

export function chooseDecisionModel(importance: number, e: Env = env()): ModelRef | null {
  const requested = parseModelRef(importance >= 8 ? e.LLM_MODEL_ESCALATION : e.LLM_MODEL_DEFAULT);
  if (requested && hasProviderKey(requested.provider, e)) return requested;

  for (const provider of providerOrder(e)) {
    if (!hasProviderKey(provider, e)) continue;
    if (provider === 'google') return parseModelRef(e.LLM_MODEL_GEMINI);
    if (provider === 'openai') {
      const fallback = parseModelRef(importance >= 8 ? 'openai/gpt-4o' : 'openai/gpt-4o-mini');
      if (fallback) return fallback;
    }
  }

  return null;
}

function modelFor(ref: ModelRef, e: Env) {
  if (ref.provider === 'google') {
    const google = createGoogleGenerativeAI({
      apiKey: e.GEMINI_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    return google(ref.model);
  }

  const openai = createOpenAI({
    apiKey: e.OPENAI_API_KEY || e.AI_GATEWAY_API_KEY,
    baseURL: e.AI_GATEWAY_API_KEY ? 'https://gateway.ai.vercel.app/v1/openai' : undefined,
  });
  return openai(ref.model);
}

function parseModelRef(modelId: string): ModelRef | null {
  const [rawProvider, ...rest] = modelId.split('/');
  const model = rest.join('/');
  if (!rawProvider || !model) return null;

  if (rawProvider === 'openai') return { provider: 'openai', model, id: modelId };
  if (rawProvider === 'google' || rawProvider === 'gemini') {
    return { provider: 'google', model, id: `google/${model}` };
  }

  return null;
}

function hasProviderKey(provider: DecisionProvider, e: Env): boolean {
  if (provider === 'google') return Boolean(e.GEMINI_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY);
  return Boolean(e.AI_GATEWAY_API_KEY || e.OPENAI_API_KEY);
}

function providerOrder(e: Env): DecisionProvider[] {
  const providers = e.LLM_PROVIDER_ORDER.split(',')
    .map((p) => p.trim().toLowerCase())
    .map((p) => (p === 'gemini' ? 'google' : p))
    .filter((p): p is DecisionProvider => p === 'openai' || p === 'google');
  return providers.length ? providers : ['openai', 'google'];
}

function buildPrompt(agent: Agent, ctx: DecisionInput['context']): string {
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
    `JOB: ${ctx.has_job ? 'employed' : 'unemployed'} HOME: ${ctx.has_home ? 'has home' : 'homeless'} FOOD ON HAND: ${ctx.food_qty}`,
    `BUSINESS: ${ctx.owned_company_id ? `owns company ${ctx.owned_company_id} with ${ctx.company_worker_count ?? 0} workers and $${((ctx.company_treasury_cents ?? 0) / 100).toFixed(0)} treasury` : 'does not own a company'}${ctx.hire_candidate_id ? `; nearby hire candidate ${ctx.hire_candidate_id}` : ''}${ctx.fire_candidate_id ? `; possible fire target ${ctx.fire_candidate_id}` : ''}`,
    `MARKET: ${(ctx.market_assets ?? [])
      .slice(0, 4)
      .map((a) => `${a.ticker} ${a.asset} last=$${(a.last_price_cents / 100).toFixed(2)} ask=${a.best_ask_cents ? `$${(a.best_ask_cents / 100).toFixed(2)}` : 'none'} bid=${a.best_bid_cents ? `$${(a.best_bid_cents / 100).toFixed(2)}` : 'none'}`)
      .join('; ') || 'no public shares quoted'}`,
    `HOLDINGS: ${(ctx.share_holdings ?? [])
      .slice(0, 4)
      .map((h) => `${h.asset} ${h.shares}sh`)
      .join('; ') || 'no shares'}`,
    ``,
    `NEARBY BUILDINGS (id - kind - name):`,
    ...ctx.buildings.slice(0, 8).map((b) => `  ${b.id} - ${b.kind} - ${b.name}`),
    ``,
    `NEARBY AGENTS:`,
    ...ctx.nearby_agents.slice(0, 5).map((a) => `  ${a.id} - ${a.name} (affinity=${a.affinity ?? 0})`),
    ``,
    `Choose one action.`,
  ].join('\n');
}
