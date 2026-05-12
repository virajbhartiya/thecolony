import { z } from 'zod';

export const ZoneKind = z.enum([
  'residential',
  'commercial',
  'industrial',
  'civic',
  'slum',
  'park',
]);
export type ZoneKind = z.infer<typeof ZoneKind>;

export const BuildingKind = z.enum([
  'house',
  'apartment',
  'shop',
  'factory',
  'farm',
  'bar',
  'cafe',
  'restaurant',
  'office',
  'clinic',
  'school',
  'newsroom',
  'construction_yard',
  'bank',
  'court',
  'jail',
  'temple',
  'town_hall',
  'water_works',
  'power_plant',
  'precinct',
  'sawmill',
  'quarry',
]);
export type BuildingKind = z.infer<typeof BuildingKind>;

export const TerrainKind = z.enum(['grass', 'road', 'water', 'sidewalk', 'sand', 'plaza']);
export type TerrainKind = z.infer<typeof TerrainKind>;

export const BuildingSchema = z.object({
  id: z.string().uuid(),
  kind: BuildingKind,
  zone_kind: ZoneKind,
  name: z.string(),
  tile_x: z.number().int(),
  tile_y: z.number().int(),
  tile_w: z.number().int(),
  tile_h: z.number().int(),
  capacity: z.number().int(),
  rent_cents: z.number().int(),
  sprite_key: z.string(),
});
export type Building = z.infer<typeof BuildingSchema>;

export const WorldSnapshotSchema = z.object({
  t: z.string(),
  sim_time: z.string(),
  speed: z.number(),
  population: z.number().int(),
  gdp_cents: z.number().int(),
  government: z.object({
    mayor_id: z.string().uuid().nullable(),
    mayor_name: z.string().nullable(),
    treasury_cents: z.number().int(),
    tax_rate_bps: z.number().int(),
    election_id: z.string().nullable(),
    next_election_at: z.string().nullable(),
    turnout: z.number().int().nullable(),
  }),
  width: z.number().int(),
  height: z.number().int(),
  buildings: z.array(BuildingSchema),
  agents: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      pos_x: z.number(),
      pos_y: z.number(),
      target_x: z.number(),
      target_y: z.number(),
      state: z.string(),
      status: z.string(),
      occupation: z.string().nullable(),
      balance_cents: z.number().int(),
      portrait_seed: z.string(),
      age_years: z.number().int().optional(),
    }),
  ),
});
export type WorldSnapshot = z.infer<typeof WorldSnapshotSchema>;

export const MAP_WIDTH = 96;
export const MAP_HEIGHT = 96;
export const TILE_W_PX = 64;
export const TILE_H_PX = 32;
export const CITY_TREASURY_ID = '00000000-0000-0000-0000-000000000001';
