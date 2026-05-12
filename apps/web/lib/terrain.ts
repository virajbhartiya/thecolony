import type { TerrainKind } from '@thecolony/domain';

/**
 * Mirror of packages/sim/src/worldgen terrain step so the client can draw the
 * ground without shipping it over the wire. Must stay in sync with server.
 */
export function generateTerrain(width: number, height: number, seed = 42): TerrainKind[][] {
  void seed;
  const terrain: TerrainKind[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'grass' as TerrainKind),
  );

  // river ~ x=70 sinusoidal
  for (let y = 0; y < height; y++) {
    const cx = Math.round(70 + Math.sin(y / 8) * 3);
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx;
      if (x >= 0 && x < width) terrain[y]![x] = 'water';
    }
  }
  // beaches
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y]![x] === 'water') continue;
      const left = x > 0 && terrain[y]![x - 1] === 'water';
      const right = x < width - 1 && terrain[y]![x + 1] === 'water';
      if (left || right) terrain[y]![x] = 'sand';
    }
  }
  // road grid
  const VERTICAL_ROADS = [8, 18, 28, 38, 50, 60];
  const HORIZONTAL_ROADS = [8, 20, 32, 44, 56, 68, 80];
  for (const rx of VERTICAL_ROADS) {
    for (let y = 0; y < height; y++) {
      if (terrain[y]![rx] !== 'water') terrain[y]![rx] = 'road';
    }
  }
  for (const ry of HORIZONTAL_ROADS) {
    for (let x = 0; x < width; x++) {
      if (terrain[ry]![x] !== 'water') terrain[ry]![x] = 'road';
    }
  }
  // bridge
  for (let x = 0; x < width; x++) {
    if (terrain[32]![x] === 'water') terrain[32]![x] = 'road';
  }
  return terrain;
}

export const TERRAIN_FILL: Record<TerrainKind, string> = {
  grass: '#4a6839',
  road: '#2c2630',
  water: '#2f6e7a',
  sand: '#cdb87a',
  plaza: '#6b6450',
  sidewalk: '#6c6c7a',
};

/** Subtle noise-driven tint so terrain doesn't look flat. */
export function grassNoiseFill(tx: number, ty: number): string {
  const n = Math.sin(tx * 1.3 + ty * 0.7) + Math.cos(tx * 0.5 - ty * 1.1);
  if (n > 1.1) return '#5b7a45';
  if (n > 0.3) return '#4a6839';
  if (n < -1.1) return '#2c4022';
  return '#3a5530';
}
