import { env, hasLLMKey } from '@thecolony/config';
import { db } from '@thecolony/db';
import { log } from './log';
import { tickDueAgents } from './agent-tick';
import { stepMovement } from './movement';
import { decayNeedsAll, sweepDeaths } from './needs';
import { applyPayroll, collectRent, applyDailyProduction } from './economy';
import { closePublisher } from './publisher';

const TICK_MS = env().WORLD_TICK_MS;
const MOVEMENT_MS = 250;
const NEEDS_DECAY_EVERY_TICKS = 6; // every 6s with 1s tick
const DAILY_EVERY_TICKS = 60 * 24; // every 24 min wall == one sim day at 1x

let stopping = false;

async function main() {
  log.info(
    {
      llm: hasLLMKey() ? 'live (key detected)' : 'heuristic fallback (no key)',
      tick_ms: TICK_MS,
      agent_count: env().SIM_AGENT_COUNT,
    },
    'sim-worker boot',
  );

  let tickCount = 0;
  const heartbeat = setInterval(async () => {
    if (stopping) return;
    tickCount++;
    try {
      const t0 = Date.now();
      const decided = await tickDueAgents(new Date());
      const t1 = Date.now();
      if (decided > 0) log.info({ decided, ms: t1 - t0 }, 'tick');

      if (tickCount % NEEDS_DECAY_EVERY_TICKS === 0) {
        await decayNeedsAll();
        await sweepDeaths();
      }
      if (tickCount % DAILY_EVERY_TICKS === 0) {
        log.info('daily: production + payroll + rent');
        await applyDailyProduction();
        await applyPayroll();
        await collectRent();
      }
    } catch (e) {
      log.error({ err: (e as Error).message }, 'tick error');
    }
  }, TICK_MS);

  const movement = setInterval(async () => {
    if (stopping) return;
    try {
      await stepMovement(MOVEMENT_MS);
    } catch (e) {
      log.warn({ err: (e as Error).message }, 'movement error');
    }
  }, MOVEMENT_MS);

  const shutdown = async (sig: string) => {
    log.info({ sig }, 'shutdown');
    stopping = true;
    clearInterval(heartbeat);
    clearInterval(movement);
    await closePublisher();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  log.error(e);
  process.exit(1);
});
