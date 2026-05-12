// 1 sim day == 24 real minutes  →  1 sim hour == 60 real seconds
export const SIM_DAY_REAL_MS = 24 * 60 * 1000;
export const SIM_HOUR_REAL_MS = SIM_DAY_REAL_MS / 24;

const SIM_EPOCH = new Date('2125-01-01T06:00:00Z').getTime();

export function realMsToSimDate(realMs: number, speed = 1): Date {
  const elapsed = (realMs - SIM_EPOCH) * speed;
  return new Date(SIM_EPOCH + elapsed * 60); // 1 real ms ≈ 60 sim ms at 1x
}

export function nowSim(realStartMs: number, speed = 1, now = Date.now()): Date {
  const elapsedReal = now - realStartMs;
  const simElapsed = elapsedReal * speed * 60;
  return new Date(SIM_EPOCH + simElapsed);
}

export function hourOfDay(simDate: Date): number {
  return simDate.getUTCHours();
}

export function isNight(simDate: Date): boolean {
  const h = hourOfDay(simDate);
  return h < 6 || h >= 20;
}
