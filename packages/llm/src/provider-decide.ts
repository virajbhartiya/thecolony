import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { env, type Env } from '@thecolony/config';
import { ActionSchema } from '@thecolony/domain';
import { z } from 'zod';
import type { DecisionInput, DecisionOutput } from './decide';
import { buildDecisionPrompt } from './prompt';
import { recordLLMUsage } from './budget';

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

  const prompt = buildDecisionPrompt(input.agent, input.context);
  const result = await generateObject({
    model: modelFor(selected, e),
    schema: DecisionResponseSchema,
    prompt,
    temperature: 0.9,
    maxRetries: 1,
  });
  const usage = usageFromResult(result);
  recordLLMUsage({
    model: selected.id,
    kind: 'decision',
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedInputTokens: estimateTokens(prompt),
    estimatedOutputTokens: estimateTokens(JSON.stringify(result.object)),
  });

  return {
    action: result.object.action,
    source: 'llm',
    model: selected.id,
    rationale: result.object.rationale,
    inner_monologue: result.object.inner_monologue,
  };
}

function usageFromResult(result: unknown): { inputTokens?: number; outputTokens?: number } {
  const usage = (result as { usage?: { promptTokens?: number; completionTokens?: number } }).usage;
  return {
    inputTokens: usage?.promptTokens,
    outputTokens: usage?.completionTokens,
  };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
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
