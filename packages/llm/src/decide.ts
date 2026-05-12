import { env, hasLLMKey } from '@thecolony/config';
import { ActionSchema, type Action, type Agent } from '@thecolony/domain';
import { heuristicDecide, type HeuristicContext } from './heuristic';

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
  try {
    const llm = await import('./openai-decide.js');
    return await llm.llmDecide(input);
  } catch (e) {
    console.warn('[llm] decide fell back to heuristic:', (e as Error).message);
    return { action: heuristicDecide(input.agent, input.context), source: 'heuristic' };
  }
}

export { ActionSchema };
export type { Action };
export { hasLLMKey };
export { env };
