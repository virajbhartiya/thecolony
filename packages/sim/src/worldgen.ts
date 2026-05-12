import { MAP_HEIGHT, MAP_WIDTH, type BuildingKind, type TerrainKind, type ZoneKind } from '@thecolony/domain';
import { mulberry32 } from './rng.js';
import { genCompanyName } from './names.js';

export interface GenBuilding {
  kind: BuildingKind;
  zone_kind: ZoneKind;
  name: string;
  tile_x: number;
  tile_y: number;
  tile_w: number;
  tile_h: number;
  capacity: number;
  rent_cents: number;
  sprite_key: string;
}

export interface GeneratedWorld {
  width: number;
  height: number;
  terrain: TerrainKind[][]; // [y][x]
  buildings: GenBuilding[];
  passable: boolean[][]; // [y][x]
}

const SPRITE_BY_KIND: Record<BuildingKind, string> = {
  house: 'house',
  apartment: 'apartment',
  shop: 'shop',
  factory: 'factory',
  farm: 'farm',
  bar: 'bar',
  office: 'office',
  bank: 'bank',
  court: 'civic',
  jail: 'civic',
  temple: 'temple',
  town_hall: 'civic',
  water_works: 'utility',
  power_plant: 'utility',
};

export function generateWorld(seed = 42): GeneratedWorld {
  const rng = mulberry32(seed);
  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;
  const terrain: TerrainKind[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'grass' as TerrainKind),
  );

  // a winding river along x ≈ 70
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

  // bridge over river at y=32
  for (let x = 0; x < width; x++) {
    if (terrain[32]![x] === 'water') terrain[32]![x] = 'road';
  }

  // zoning by quadrant
  function zoneAt(x: number, y: number): ZoneKind {
    if (x > 72) return 'park'; // east of river: park strip
    if (y < 20) return 'civic';
    if (y < 44 && x < 30) return 'residential';
    if (y < 44 && x >= 30 && x < 60) return 'commercial';
    if (y >= 44 && y < 68 && x < 30) return 'slum';
    if (y >= 44 && y < 68 && x >= 30 && x < 60) return 'industrial';
    return 'residential';
  }

  const buildings: GenBuilding[] = [];

  function place(
    kind: BuildingKind,
    x: number,
    y: number,
    w: number,
    h: number,
    overrides: Partial<GenBuilding> = {},
  ) {
    // ensure clear of roads / water
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) return;
        const t = terrain[ty]![tx];
        if (t === 'road' || t === 'water' || t === 'sand') return;
      }
    const zone = zoneAt(x, y);
    const name = overrides.name ?? `${kind}-${buildings.length}`;
    buildings.push({
      kind,
      zone_kind: zone,
      name,
      tile_x: x,
      tile_y: y,
      tile_w: w,
      tile_h: h,
      capacity: overrides.capacity ?? capacityFor(kind),
      rent_cents: overrides.rent_cents ?? rentFor(kind),
      sprite_key: SPRITE_BY_KIND[kind],
    });
    // mark plaza around it
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (terrain[ty]![tx] === 'grass') terrain[ty]![tx] = 'plaza';
      }
  }

  // civic core (top middle)
  place('town_hall', 22, 4, 4, 4, { name: 'Town Hall' });
  place('court', 32, 5, 3, 3, { name: 'Riverside Court' });
  place('bank', 40, 5, 3, 3, { name: 'First Bank' });
  place('temple', 48, 5, 3, 3, { name: 'Old Temple' });

  // commercial strip
  for (let i = 0; i < 5; i++) {
    place('shop', 31 + i * 5, 22, 2, 2, {
      name: ['Riverside Market', 'Glass Goods', 'Old Spice', 'New Bread', 'Iron Tools'][i] ?? `Shop ${i}`,
    });
  }
  place('bar', 46, 26, 3, 2, { name: 'The Drunk Gull' });
  place('office', 52, 22, 3, 3, { name: 'Vex & Co.' });

  // residential (NW quadrant)
  for (let i = 0; i < 6; i++) {
    place('house', 10 + (i % 3) * 4, 22 + Math.floor(i / 3) * 5, 2, 2);
  }
  place('apartment', 22, 28, 3, 4, { name: 'Brae Apartments', capacity: 12 });
  place('apartment', 14, 36, 3, 4, { name: 'Holt Tenements', capacity: 16 });

  // slum (SW)
  for (let i = 0; i < 5; i++) {
    place('house', 4 + (i % 3) * 4, 52 + Math.floor(i / 3) * 4, 2, 2, { rent_cents: 500 });
  }
  place('bar', 12, 64, 3, 2, { name: 'The Sinkhole' });

  // industrial (SE)
  place('factory', 40, 50, 4, 3, { name: 'Glass Works' });
  place('factory', 50, 50, 4, 3, { name: 'Iron Forge' });
  place('factory', 40, 60, 4, 3, { name: 'Cloth Mill' });
  place('water_works', 50, 60, 3, 3, { name: 'Waterworks' });
  place('power_plant', 56, 60, 3, 3, { name: 'Power Plant' });

  // farms (NE pre-park)
  place('farm', 60, 14, 4, 3, { name: 'River Farm A' });
  place('farm', 60, 22, 4, 3, { name: 'River Farm B' });

  // passability: roads, plazas, sand are passable. water and buildings are not.
  const passable: boolean[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => false),
  );
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = terrain[y]![x];
      passable[y]![x] = t === 'road' || t === 'plaza' || t === 'sand' || t === 'grass';
    }
  }
  for (const b of buildings) {
    for (let dy = 0; dy < b.tile_h; dy++)
      for (let dx = 0; dx < b.tile_w; dx++) {
        const tx = b.tile_x + dx;
        const ty = b.tile_y + dy;
        if (tx >= 0 && ty >= 0 && tx < width && ty < height) passable[ty]![tx] = false;
      }
  }

  return { width, height, terrain, buildings, passable };
}

function capacityFor(kind: BuildingKind): number {
  switch (kind) {
    case 'house':
      return 4;
    case 'apartment':
      return 12;
    case 'shop':
      return 6;
    case 'factory':
      return 10;
    case 'farm':
      return 6;
    case 'bar':
      return 12;
    case 'office':
      return 8;
    case 'bank':
      return 6;
    case 'court':
      return 6;
    case 'jail':
      return 8;
    case 'temple':
      return 20;
    case 'town_hall':
      return 12;
    case 'water_works':
      return 4;
    case 'power_plant':
      return 4;
  }
}

function rentFor(kind: BuildingKind): number {
  switch (kind) {
    case 'house':
      return 2500;
    case 'apartment':
      return 1500;
    default:
      return 0;
  }
}

void genCompanyName;
