export const TILE_W = 64;
export const TILE_H = 32;

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
