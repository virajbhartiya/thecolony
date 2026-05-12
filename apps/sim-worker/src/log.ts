import { pino } from 'pino';

export const log = pino({
  transport: {
    target: 'pino-pretty',
    options: { translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
  },
  base: { svc: 'sim-worker' },
});
