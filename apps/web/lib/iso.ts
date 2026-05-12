export const TILE_W = 56;
export const TILE_H = 28;

export function tileToWorld(tx: number, ty: number): { x: number; y: number } {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2),
  };
}

export function worldToTile(wx: number, wy: number): { tx: number; ty: number } {
  const tx = wy / TILE_H + wx / TILE_W;
  const ty = wy / TILE_H - wx / TILE_W;
  return { tx, ty };
}

/**
 * Sim-time-of-day phase 0..1.
 *   0   = midnight
 *   0.25 = dawn
 *   0.5 = noon
 *   0.75 = dusk
 *
 * Driven by elapsed real time from a fixed epoch so the city visibly
 * passes through a full day every 24 real minutes — otherwise the
 * camera would be locked at whatever UTC hour the demo is running.
 */
const SIM_DAY_REAL_MS = 24 * 60 * 1000;
const SIM_EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);

export function dayPhaseFromSimTime(_t?: string | Date | null): number {
  void _t;
  const elapsed = Date.now() - SIM_EPOCH;
  return (((elapsed % SIM_DAY_REAL_MS) + SIM_DAY_REAL_MS) % SIM_DAY_REAL_MS) / SIM_DAY_REAL_MS;
}
