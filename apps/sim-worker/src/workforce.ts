import { db, schema } from '@thecolony/db';
import { sql } from 'drizzle-orm';
import { writeEvent } from './event-writer';

export async function ensureJobPostings(): Promise<number> {
  const companies = await db.execute<{
    id: string;
    name: string;
    industry: string | null;
    building_id: string;
    building: string;
    capacity: number;
    workers: number;
  }>(sql`
    SELECT c.id, c.name, c.industry, c.building_id, b.name AS building, b.capacity,
      COUNT(j.id)::int AS workers
    FROM ${schema.company} c
    JOIN ${schema.building} b ON b.id = c.building_id
    LEFT JOIN ${schema.job} j ON j.company_id = c.id AND j.ended_at IS NULL
    WHERE c.dissolved_at IS NULL AND c.building_id IS NOT NULL
    GROUP BY c.id, c.name, c.industry, c.building_id, b.name, b.capacity
    ORDER BY c.name
  `);

  let posted = 0;
  for (const company of companies) {
    const targetHeadcount = Math.max(1, Math.min(Number(company.capacity), 5));
    const openings = targetHeadcount - Number(company.workers);
    if (openings <= 0) continue;

    const recent = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n
      FROM ${schema.world_event}
      WHERE kind = 'job_posted'
        AND payload->>'company_id' = ${company.id}
        AND t > now() - interval '20 minutes'
    `);
    if (Number(recent[0]?.n ?? 0) > 0) continue;

    const role = roleForIndustry(company.industry);
    const wage_cents = wageForRole(role);
    await writeEvent({
      kind: 'job_posted',
      actor_ids: [company.id],
      location_id: company.building_id,
      importance: 4,
      payload: {
        company_id: company.id,
        company: company.name,
        building: company.building,
        role,
        wage_cents,
        openings,
      },
    });
    posted++;
  }
  return posted;
}

export function roleForIndustry(industry: string | null | undefined): string {
  switch (industry) {
    case 'farm':
      return 'farmer';
    case 'factory':
      return 'builder';
    case 'shop':
      return 'shopkeeper';
    case 'bar':
      return 'bartender';
    case 'bank':
    case 'office':
      return 'stock broker';
    case 'court':
    case 'jail':
      return 'guard';
    case 'town_hall':
      return 'civil servant';
    case 'water_works':
    case 'power_plant':
      return 'engineer';
    default:
      return 'worker';
  }
}

export function wageForRole(role: string): number {
  const normalized = role.toLowerCase();
  if (normalized.includes('broker')) return 2800;
  if (normalized.includes('engineer')) return 2400;
  if (normalized.includes('builder')) return 2200;
  if (normalized.includes('shopkeeper')) return 2100;
  if (normalized.includes('chef')) return 2000;
  if (normalized.includes('guard')) return 2000;
  if (normalized.includes('civil')) return 2000;
  if (normalized.includes('bartender')) return 1900;
  if (normalized.includes('farmer')) return 1700;
  return 1600;
}
