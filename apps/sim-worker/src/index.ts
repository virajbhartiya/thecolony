import { env, hasLLMKey } from '@thecolony/config';
import { db } from '@thecolony/db';
import { log } from './log';
import { tickDueAgents } from './agent-tick';
import { stepMovement } from './movement';
import { decayNeedsAll, sweepDeaths } from './needs';
import { applyPayroll, collectRent, applyDailyProduction } from './economy';
import { spawnMigrantsIfNeeded } from './migrants';
import { applyCivicCycle, ensureGovernment } from './government';
import { clearMarketOrders, ensureEquityMarket } from './market';
import { ensureJobPostings } from './workforce';
import { applyCourtSession, releaseJailedAgents } from './justice';
import { applyBeliefUpdates } from './groups';
import { applyConceptions, sweepLifecycle } from './lifecycle';
import { generateDailyReport } from './daily-report';
import { closePublisher } from './publisher';

const TICK_MS = env().WORLD_TICK_MS;
const MOVEMENT_MS = 250;
const NEEDS_DECAY_EVERY_TICKS = 6; // every 6s
const MARKET_EVERY_TICKS = 15;
const COURT_EVERY_TICKS = 30;
const BELIEF_EVERY_TICKS = 90;
// Demo cadence: dailies fire every 60s real time so GDP/payroll/rent visibly move.
const DAILY_EVERY_TICKS = 60;

let stopping = false;

async function main() {
  await ensureGovernment();
  await ensureEquityMarket();
  await ensureJobPostings();
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
        await sweepLifecycle();
        const released = await releaseJailedAgents();
        if (released > 0) log.info({ released }, 'jail release');
      }
      if (tickCount % MARKET_EVERY_TICKS === 0) {
        const trades = await clearMarketOrders();
        if (trades > 0) log.info({ trades }, 'market clear');
      }
      if (tickCount % COURT_EVERY_TICKS === 0) {
        const cases = await applyCourtSession();
        if (cases > 0) log.info({ cases }, 'court session');
      }
      if (tickCount % BELIEF_EVERY_TICKS === 0) {
        const beliefs = await applyBeliefUpdates();
        if (beliefs > 0) log.info({ beliefs }, 'belief update');
      }
      if (tickCount % DAILY_EVERY_TICKS === 0) {
        log.info('daily: production + payroll + rent + civic cycle + migrants');
        await applyDailyProduction();
        await applyPayroll();
        await collectRent();
        await applyCivicCycle();
        await ensureEquityMarket();
        await ensureJobPostings();
        await spawnMigrantsIfNeeded();
        const births = await applyConceptions();
        if (births > 0) log.info({ births }, 'births');
        const report = await generateDailyReport();
        if (report?.created) log.info({ slug: report.report.slug }, 'daily report');
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
