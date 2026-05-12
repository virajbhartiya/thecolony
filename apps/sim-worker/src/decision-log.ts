import { db, schema } from '@thecolony/db';
import type { Agent } from '@thecolony/domain';
import type { DecisionOutput, HeuristicContext } from '@thecolony/llm';
import {
  canonicalize,
  hashDecisionPrompt,
  serializeDecisionContext,
} from './decision-replay';

export interface RecordAgentDecisionInput {
  agent: Agent;
  context: HeuristicContext;
  decision: DecisionOutput;
  rngSeed: number;
  t: Date;
}

export async function recordAgentDecisionLog(input: RecordAgentDecisionInput): Promise<number> {
  const [row] = await db
    .insert(schema.agent_decision_log)
    .values({
      t: input.t,
      agent_id: input.agent.id,
      source: input.decision.source,
      model: input.decision.model ?? (input.decision.source === 'heuristic' ? 'heuristic/v1' : null),
      prompt_hash: hashDecisionPrompt(input.agent, input.context),
      rng_seed: input.rngSeed,
      agent_snapshot: canonicalize(input.agent),
      context_snapshot: serializeDecisionContext(input.context, input.rngSeed),
      action: canonicalize(input.decision.action),
      action_kind: input.decision.action.kind,
      rationale: input.decision.rationale ?? null,
      inner_monologue: input.decision.inner_monologue ?? null,
    })
    .returning({ id: schema.agent_decision_log.id });

  return row?.id ?? 0;
}
