import { env, hasLLMKey } from '@thecolony/config';
import { ActionSchema, type Action, type Agent } from '@thecolony/domain';
import { heuristicDecide, type HeuristicContext } from './heuristic';
import { canCallLLM, recordCall } from './rate-limit';
import { shouldUseLLMForDecision } from './budget';
import { providerDecide } from './provider-decide';

export interface DecisionInput {
  agent: Agent;
  context: HeuristicContext;
  importance?: number;
}

export interface DecisionOutput {
  action: Action;
  source: 'llm' | 'heuristic';
  model?: string;
  rationale?: string;
  inner_monologue?: string;
}

const gateStats = { noKey: 0, budget: 0, rate: 0, ok: 0, err: 0 };
let _statsTimer: ReturnType<typeof setInterval> | null = null;
function ensureStatsTimer() {
  if (_statsTimer || typeof setInterval === 'undefined') return;
  _statsTimer = setInterval(() => {
    const total = Object.values(gateStats).reduce((s, n) => s + n, 0);
    if (total > 0) console.log('[llm] gate-stats', JSON.stringify(gateStats), 'total=' + total);
    for (const k of Object.keys(gateStats) as Array<keyof typeof gateStats>) gateStats[k] = 0;
  }, 30_000);
  const t = _statsTimer as unknown as { unref?: () => void };
  if (typeof t.unref === 'function') t.unref();
}
ensureStatsTimer();

export async function decide(input: DecisionInput): Promise<DecisionOutput> {
  if (!hasLLMKey()) {
    gateStats.noKey++;
    return { action: heuristicDecide(input.agent, input.context), source: 'heuristic' };
  }
  if (!shouldUseLLMForDecision(input.agent.id, input.importance ?? 3)) {
    gateStats.budget++;
    return { action: heuristicDecide(input.agent, input.context), source: 'heuristic' };
  }
  if (!canCallLLM()) {
    gateStats.rate++;
    return { action: heuristicDecide(input.agent, input.context), source: 'heuristic' };
  }
  recordCall();
  try {
    const r = await providerDecide(input);
    gateStats.ok++;
    console.log('[llm] OK', r.model ?? '?', '→', r.action.kind);
    return r;
  } catch (e) {
    gateStats.err++;
    const msg = (e as Error).message ?? '';
    console.warn('[llm] FALLBACK:', msg.slice(0, 200));
    return { action: heuristicDecide(input.agent, input.context), source: 'heuristic' };
  }
}

export { ActionSchema };
export type { Action };
export { hasLLMKey };
export { env };
