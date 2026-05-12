// Mirror of packages/sim/worldgen.ts terrain step so the client can render terrain
// without shipping it over the wire. Keep in sync.
import { mulberry32 } from '@thecolony/sim';
import type { TerrainKind } from '@thecolony/domain';

export function generateTerrain(width: number, height: number, seed = 42): TerrainKind[][] {
  void mulberry32(seed);
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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y]![x] === 'water') continue;
      const left = x > 0 && terrain[y]![x - 1] === 'water';
      const right = x < width - 1 && terrain[y]![x + 1] === 'water';
      if (left || right) terrain[y]![x] = 'sand';
    }
  }

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
  for (let x = 0; x < width; x++) {
    if (terrain[32]![x] === 'water') terrain[32]![x] = 'road';
  }
  return terrain;
}
