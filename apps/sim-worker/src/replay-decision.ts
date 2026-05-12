import { db, rawClient, schema } from '@thecolony/db';
import { desc, eq } from 'drizzle-orm';
import { replayLoggedDecision } from './decision-replay';

async function main() {
  const idArg = process.argv[2] ?? 'latest';
  const requireHeuristic = process.argv.includes('--require-heuristic');
  const row = await loadDecisionLog(idArg);

  if (!row) {
    console.error(`[replay] no decision log row found for ${idArg}`);
    process.exit(1);
  }
  if (requireHeuristic && row.source !== 'heuristic') {
    console.error(`[replay] row ${row.id} is ${row.source}; pass a heuristic row for deterministic recompute`);
    process.exit(1);
  }

  const replay = replayLoggedDecision(row);
  const payload = {
    id: row.id,
    agent_id: row.agent_id,
    source: row.source,
    model: row.model,
    mode: replay.mode,
    action_kind: row.action_kind,
    prompt_hash: replay.prompt_hash,
    matches_action: replay.matches_action,
    matches_prompt_hash: replay.matches_prompt_hash,
    action: replay.action,
  };
  console.log(JSON.stringify(payload, null, 2));

  if (!replay.matches_action || !replay.matches_prompt_hash) process.exit(2);
}

async function loadDecisionLog(idArg: string) {
  if (idArg === 'latest-heuristic') {
    const rows = await db
      .select()
      .from(schema.agent_decision_log)
      .where(eq(schema.agent_decision_log.source, 'heuristic'))
      .orderBy(desc(schema.agent_decision_log.t), desc(schema.agent_decision_log.id))
      .limit(1);
    return rows[0] ?? null;
  }
  if (idArg === 'latest') {
    const rows = await db
      .select()
      .from(schema.agent_decision_log)
      .orderBy(desc(schema.agent_decision_log.t), desc(schema.agent_decision_log.id))
      .limit(1);
    return rows[0] ?? null;
  }

  const id = Number(idArg);
  if (!Number.isInteger(id) || id <= 0) {
    console.error('[replay] usage: pnpm --filter @thecolony/sim-worker replay [latest|latest-heuristic|id] [--require-heuristic]');
    process.exit(1);
  }

  const rows = await db
    .select()
    .from(schema.agent_decision_log)
    .where(eq(schema.agent_decision_log.id, id))
    .limit(1);
  return rows[0] ?? null;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await rawClient.end();
  });
