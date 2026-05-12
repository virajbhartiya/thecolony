import { createHash } from 'node:crypto';
import { ActionSchema, type Action, type Agent } from '@thecolony/domain';
import { buildDecisionPrompt, heuristicDecide, type HeuristicContext } from '@thecolony/llm';
import { mulberry32 } from '@thecolony/sim';

export interface ReplayableDecisionLog {
  id?: number;
  agent_id?: string;
  source: 'llm' | 'heuristic' | string;
  model?: string | null;
  prompt_hash: string;
  rng_seed: number;
  agent_snapshot: unknown;
  context_snapshot: unknown;
  action: unknown;
  action_kind?: string;
}

export interface DecisionReplayResult {
  action: Action;
  expected_action: Action;
  mode: 'recomputed_heuristic' | 'stored_llm_output';
  prompt_hash: string;
  matches_action: boolean;
  matches_prompt_hash: boolean;
}

export function serializeDecisionContext(
  context: HeuristicContext,
  rngSeed: number,
): Record<string, unknown> {
  const { rng: _rng, ...rest } = context;
  return canonicalize({ ...rest, rng_seed: rngSeed }) as Record<string, unknown>;
}

export function hydrateDecisionContext(snapshot: unknown, rngSeed: number): HeuristicContext {
  const raw = { ...(snapshot as Record<string, unknown>) };
  delete raw.rng_seed;
  return { ...raw, rng: mulberry32(rngSeed) } as unknown as HeuristicContext;
}

export function hashDecisionPrompt(agent: Agent, context: HeuristicContext): string {
  return sha256(buildDecisionPrompt(agent, context));
}

export function replayLoggedDecision(row: ReplayableDecisionLog): DecisionReplayResult {
  const agent = row.agent_snapshot as Agent;
  const context = hydrateDecisionContext(row.context_snapshot, Number(row.rng_seed));
  const expectedAction = ActionSchema.parse(row.action);
  const promptHash = hashDecisionPrompt(agent, context);
  const action =
    row.source === 'heuristic' ? heuristicDecide(agent, context) : ActionSchema.parse(row.action);

  return {
    action,
    expected_action: expectedAction,
    mode: row.source === 'heuristic' ? 'recomputed_heuristic' : 'stored_llm_output',
    prompt_hash: promptHash,
    matches_action: stableStringify(action) === stableStringify(expectedAction),
    matches_prompt_hash: promptHash === row.prompt_hash,
  };
}

export function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const child = (value as Record<string, unknown>)[key];
    if (typeof child === 'undefined' || typeof child === 'function') continue;
    out[key] = canonicalize(child);
  }
  return out;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
