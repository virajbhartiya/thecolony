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
 * Sim-time-of-day phase 0..1 from a Date or ISO string.
 * 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk.
 * Pulls only the time-of-day component.
 */
export function dayPhaseFromSimTime(t: string | Date | null | undefined): number {
  if (!t) return 0.5;
  const d = typeof t === 'string' ? new Date(t) : t;
  if (Number.isNaN(d.getTime())) return 0.5;
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (minutes % 1440) / 1440;
}
