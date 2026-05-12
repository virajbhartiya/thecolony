import assert from 'node:assert/strict';
import test from 'node:test';
import type { Agent } from '@thecolony/domain';
import { heuristicDecide, type HeuristicContext } from '@thecolony/llm';
import { mulberry32 } from '@thecolony/sim';
import {
  hashDecisionPrompt,
  replayLoggedDecision,
  serializeDecisionContext,
} from './decision-replay';

const agent: Agent = {
  id: '00000000-0000-4000-8000-000000000101',
  name: 'Nira Sol',
  born_at: '2001-01-01T00:00:00.000Z',
  died_at: null,
  age_years: 31,
  traits: {
    openness: 0.5,
    conscientiousness: 0.5,
    extraversion: 0.45,
    agreeableness: 0.4,
    neuroticism: 0.2,
    greed: 0.5,
    risk: 0.3,
    empathy: 0.5,
    ambition: 0.55,
    sociability: 0.35,
    paranoia: 0.1,
    ideology_lean: 0,
  },
  needs: {
    hunger: 20,
    energy: 65,
    social: 50,
    money_anxiety: 30,
    life_satisfaction: 55,
  },
  occupation: 'builder',
  employer_id: null,
  home_id: null,
  balance_cents: 1800,
  status: 'alive',
  portrait_seed: 'nira',
  pos_x: 4,
  pos_y: 4,
  target_x: 4,
  target_y: 4,
  state: 'idle',
};

function context(seed: number): HeuristicContext {
  return {
    buildings: [
      {
        id: '00000000-0000-4000-8000-000000000201',
        kind: 'apartment',
        name: 'North Stack Flats',
        tile_x: 6,
        tile_y: 6,
      },
    ],
    nearby_agents: [],
    has_job: false,
    has_home: false,
    food_qty: 0,
    rng: mulberry32(seed),
  };
}

test('replays a heuristic decision to the same action with the logged seed', () => {
  const rngSeed = 421337;
  const ctx = context(rngSeed);
  const action = heuristicDecide(agent, ctx);
  const row = {
    source: 'heuristic',
    model: 'heuristic/v1',
    rng_seed: rngSeed,
    prompt_hash: hashDecisionPrompt(agent, ctx),
    agent_snapshot: agent,
    context_snapshot: serializeDecisionContext(ctx, rngSeed),
    action,
    action_kind: action.kind,
  };

  const replay = replayLoggedDecision(row);

  assert.equal(replay.mode, 'recomputed_heuristic');
  assert.equal(replay.matches_action, true);
  assert.equal(replay.matches_prompt_hash, true);
  assert.deepEqual(replay.action, action);
});
