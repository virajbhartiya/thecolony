import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@thecolony/config';
import { ActionSchema, type Agent } from '@thecolony/domain';
import { z } from 'zod';
import type { DecisionInput, DecisionOutput } from './decide';

const openai = createOpenAI({
  apiKey: env().OPENAI_API_KEY || env().AI_GATEWAY_API_KEY,
  baseURL: env().AI_GATEWAY_API_KEY ? 'https://gateway.ai.vercel.app/v1/openai' : undefined,
});

const DecisionResponseSchema = z.object({
  action: ActionSchema,
  inner_monologue: z.string().max(280).optional(),
  rationale: z.string().max(280).optional(),
});

function pickModel(importance: number): string {
  if (importance >= 8) return env().LLM_MODEL_ESCALATION.replace(/^openai\//, '');
  return env().LLM_MODEL_DEFAULT.replace(/^openai\//, '');
}

export async function llmDecide(input: DecisionInput): Promise<DecisionOutput> {
  const { agent, context, importance = 3 } = input;
  const modelId = pickModel(importance);
  const prompt = buildPrompt(agent, context);
  const result = await generateObject({
    model: openai(modelId),
    schema: DecisionResponseSchema,
    prompt,
    temperature: 0.9,
    maxRetries: 1,
  });
  return {
    action: result.object.action,
    source: 'llm',
    model: modelId,
    rationale: result.object.rationale,
    inner_monologue: result.object.inner_monologue,
  };
}

function buildPrompt(agent: Agent, ctx: DecisionInput['context']): string {
  const t = agent.traits;
  const n = agent.needs;
  return [
    `You are simulating one citizen of a living city. Speak only as them.`,
    `You are NOT a helpful assistant. You are this person and you may be selfish, fearful, kind, cruel, weird.`,
    `Output exactly one chosen action as JSON matching the provided schema. Pick the action this person would choose now.`,
    ``,
    `CITIZEN: ${agent.name} (age ${agent.age_years})`,
    `TRAITS: greed=${t.greed.toFixed(2)} risk=${t.risk.toFixed(2)} empathy=${t.empathy.toFixed(2)} ambition=${t.ambition.toFixed(2)} sociability=${t.sociability.toFixed(2)} paranoia=${t.paranoia.toFixed(2)}`,
    `STATE: hunger=${n.hunger.toFixed(0)} energy=${n.energy.toFixed(0)} life_sat=${n.life_satisfaction.toFixed(0)} balance=$${(agent.balance_cents / 100).toFixed(2)}`,
    `JOB: ${ctx.has_job ? 'employed' : 'unemployed'} HOME: ${ctx.has_home ? 'has home' : 'homeless'} FOOD ON HAND: ${ctx.food_qty}`,
    ``,
    `NEARBY BUILDINGS (id — kind — name):`,
    ...ctx.buildings.slice(0, 8).map((b) => `  ${b.id} — ${b.kind} — ${b.name}`),
    ``,
    `NEARBY AGENTS:`,
    ...ctx.nearby_agents.slice(0, 5).map((a) => `  ${a.id} — ${a.name} (affinity=${a.affinity ?? 0})`),
    ``,
    `Choose one action.`,
  ].join('\n');
}
