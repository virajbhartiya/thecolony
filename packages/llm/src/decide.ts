import { env, hasLLMKey } from '@thecolony/config';
import { ActionSchema, type Action, type Agent } from '@thecolony/domain';
import { heuristicDecide, type HeuristicContext } from './heuristic';
import { canCallLLM, recordCall } from './rate-limit';

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

export async function decide(input: DecisionInput): Promise<DecisionOutput> {
  if (!hasLLMKey()) {
    return { action: heuristicDecide(input.agent, input.context), source: 'heuristic' };
  }
  if (!canCallLLM()) {
    return { action: heuristicDecide(input.agent, input.context), source: 'heuristic' };
  }
  recordCall();
  try {
    const llm = await import('./provider-decide');
    return await llm.providerDecide(input);
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (!msg.includes('Rate limit')) {
      console.warn('[llm] decide fell back to heuristic:', msg.slice(0, 160));
    }
    return { action: heuristicDecide(input.agent, input.context), source: 'heuristic' };
  }
}

export { ActionSchema };
export type { Action };
export { hasLLMKey };
export { env };
