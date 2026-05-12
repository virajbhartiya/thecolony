import { env } from '@thecolony/config';

export type LLMBudgetMode = 'normal' | 'thrift' | 'panic';

export interface LLMUsageInput {
  model: string;
  kind: 'decision' | 'doctrine' | 'eulogy' | 'embedding' | 'other';
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
}

export interface LLMBudgetSnapshot {
  window_started_at: string;
  spent_usd: number;
  cap_usd: number;
  ratio: number;
  mode: LLMBudgetMode;
}

interface BudgetState {
  windowStartedAt: number;
  spentUsd: number;
  softAlerted: boolean;
  hardAlerted: boolean;
}

const HOUR_MS = 60 * 60 * 1000;
const SOFT_RATIO = 0.7;

const state: BudgetState = {
  windowStartedAt: Date.now(),
  spentUsd: 0,
  softAlerted: false,
  hardAlerted: false,
};

const PRICE_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai/gpt-4o': { input: 5, output: 15 },
  'google/gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'openai/text-embedding-3-small': { input: 0.02, output: 0 },
};

export function currentBudgetMode(now = Date.now()): LLMBudgetMode {
  const snapshot = getLLMBudgetSnapshot(now);
  if (snapshot.ratio >= 1) return 'panic';
  if (snapshot.ratio >= SOFT_RATIO) return 'thrift';
  return 'normal';
}

export function getLLMBudgetSnapshot(now = Date.now()): LLMBudgetSnapshot {
  rollWindowIfNeeded(now);
  const cap = Math.max(0, env().LLM_HOURLY_USD_CAP);
  const ratio = cap <= 0 ? 1 : state.spentUsd / cap;
  return {
    window_started_at: new Date(state.windowStartedAt).toISOString(),
    spent_usd: Number(state.spentUsd.toFixed(6)),
    cap_usd: cap,
    ratio: Number(ratio.toFixed(4)),
    mode: ratio >= 1 ? 'panic' : ratio >= SOFT_RATIO ? 'thrift' : 'normal',
  };
}

export function shouldUseLLMForDecision(agentId: string, importance: number, now = Date.now()): boolean {
  const mode = currentBudgetMode(now);
  if (mode === 'panic') return false;
  if (mode === 'thrift' && importance < 8) {
    return hashString(`${agentId}:${hourBucket(now)}`) % 2 === 1;
  }
  return true;
}

export function recordLLMUsage(input: LLMUsageInput, now = Date.now()): LLMBudgetSnapshot {
  rollWindowIfNeeded(now);
  state.spentUsd += estimateLLMCostUsd(input);
  const snapshot = getLLMBudgetSnapshot(now);

  if (snapshot.mode === 'thrift' && !state.softAlerted) {
    state.softAlerted = true;
    void sendBudgetAlert('soft', snapshot);
  }
  if (snapshot.mode === 'panic' && !state.hardAlerted) {
    state.hardAlerted = true;
    void sendBudgetAlert('hard', snapshot);
  }

  return snapshot;
}

export function estimateLLMCostUsd(input: LLMUsageInput): number {
  const price = PRICE_PER_1M_TOKENS[input.model] ?? inferPrice(input.model);
  const inputTokens = input.inputTokens ?? input.estimatedInputTokens ?? fallbackInputTokens(input.kind);
  const outputTokens =
    input.outputTokens ?? input.estimatedOutputTokens ?? fallbackOutputTokens(input.kind);
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

function inferPrice(model: string): { input: number; output: number } {
  if (model.includes('embedding')) return PRICE_PER_1M_TOKENS['openai/text-embedding-3-small']!;
  if (model.includes('gpt-4o-mini')) return PRICE_PER_1M_TOKENS['openai/gpt-4o-mini']!;
  if (model.includes('gpt-4o')) return PRICE_PER_1M_TOKENS['openai/gpt-4o']!;
  if (model.includes('gemini')) return PRICE_PER_1M_TOKENS['google/gemini-2.5-flash']!;
  return PRICE_PER_1M_TOKENS['openai/gpt-4o-mini']!;
}

function fallbackInputTokens(kind: LLMUsageInput['kind']): number {
  switch (kind) {
    case 'decision':
      return 2200;
    case 'doctrine':
    case 'eulogy':
      return 900;
    case 'embedding':
      return 512;
    case 'other':
      return 1000;
  }
}

function fallbackOutputTokens(kind: LLMUsageInput['kind']): number {
  switch (kind) {
    case 'decision':
      return 350;
    case 'doctrine':
    case 'eulogy':
      return 250;
    case 'embedding':
      return 0;
    case 'other':
      return 250;
  }
}

function rollWindowIfNeeded(now: number): void {
  if (now - state.windowStartedAt < HOUR_MS) return;
  state.windowStartedAt = now;
  state.spentUsd = 0;
  state.softAlerted = false;
  state.hardAlerted = false;
}

async function sendBudgetAlert(level: 'soft' | 'hard', snapshot: LLMBudgetSnapshot): Promise<void> {
  const url = env().LLM_BUDGET_WEBHOOK_URL;
  if (!url) return;

  const text =
    level === 'hard'
      ? `TheColony LLM hard cap reached: $${snapshot.spent_usd.toFixed(4)} / $${snapshot.cap_usd.toFixed(2)} this hour. Live LLM calls are blocked.`
      : `TheColony LLM soft budget warning: $${snapshot.spent_usd.toFixed(4)} / $${snapshot.cap_usd.toFixed(2)} this hour. Thrift mode is active.`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        subject: level === 'hard' ? 'TheColony LLM hard cap reached' : 'TheColony LLM budget warning',
        severity: level === 'hard' ? 'critical' : 'warning',
        budget: snapshot,
      }),
    });
  } catch (e) {
    console.warn('[llm] budget alert webhook failed:', (e as Error).message.slice(0, 160));
  }
}

function hourBucket(now: number): number {
  return Math.floor(now / HOUR_MS);
}

function hashString(value: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
