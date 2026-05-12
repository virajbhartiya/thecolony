import { db, schema } from '@thecolony/db';
import { sql } from 'drizzle-orm';
import { env } from '@thecolony/config';
import { CITY_TREASURY_ID } from '@thecolony/domain';
import {
  applyProfessionBias,
  generateWorld,
  genName,
  genStarterNeeds,
  genTraits,
  mulberry32,
  pickProfession,
  type ProfessionProfile,
} from '@thecolony/sim';
import { log } from './log';
import { ensureEquityMarket } from './market';

async function main() {
  log.info('seeding world');
  const world = generateWorld(42);

  await db.execute(sql`TRUNCATE TABLE
    ${schema.world_event},
    ${schema.city_vote},
    ${schema.city_state},
    ${schema.death_event},
    ${schema.birth_event},
    ${schema.price_observation},
    ${schema.share_holding},
    ${schema.company_member},
    ${schema.market_order},
    ${schema.message},
    ${schema.conversation},
    ${schema.group_membership},
    ${schema.ideology_group},
    ${schema.incident},
    ${schema.agent_memory},
    ${schema.agent_relationship},
    ${schema.ledger_entry},
    ${schema.inventory},
    ${schema.job},
    ${schema.company},
    ${schema.agent},
    ${schema.building},
    ${schema.item_type}
    RESTART IDENTITY CASCADE`);

  // item types
  await db.insert(schema.item_type).values([
    { id: 1, key: 'food', base_value_cents: 200, perishable: true },
    { id: 2, key: 'water', base_value_cents: 50, perishable: true },
    { id: 3, key: 'energy', base_value_cents: 100, perishable: false },
    { id: 4, key: 'cloth', base_value_cents: 400, perishable: false },
    { id: 5, key: 'tool', base_value_cents: 1200, perishable: false },
    { id: 6, key: 'luxury', base_value_cents: 3000, perishable: false },
  ]);

  // buildings
  const buildingRows = await db
    .insert(schema.building)
    .values(
      world.buildings.map((b) => ({
        kind: b.kind,
        zone_kind: b.zone_kind,
        name: b.name,
        tile_x: b.tile_x,
        tile_y: b.tile_y,
        tile_w: b.tile_w,
        tile_h: b.tile_h,
        capacity: b.capacity,
        rent_cents: b.rent_cents,
        sprite_key: b.sprite_key,
        owner_kind: 'city' as const,
      })),
    )
    .returning({ id: schema.building.id, kind: schema.building.kind, tile_x: schema.building.tile_x, tile_y: schema.building.tile_y });
  log.info({ count: buildingRows.length }, 'inserted buildings');

  // companies — economic and civic workplaces. Founders are assigned after agents exist.
  const producingKinds = new Set([
    'farm',
    'factory',
    'water_works',
    'power_plant',
    'shop',
    'bar',
    'bank',
    'office',
    'court',
    'town_hall',
    'temple',
    'jail',
  ]);
  const producing = buildingRows.filter((b) => producingKinds.has(b.kind));
  const companyRows: Array<{
    id: string;
    name: string;
    industry: string | null;
    building_id: string | null;
  }> = [];
  for (const b of producing) {
    const industry = industryForBuilding(b.kind);
    const [c] = await db
      .insert(schema.company)
      .values({
        name: companyNameFor(b.kind, b.id, rngForName(b.id)),
        founder_id: null,
        charter: { industry, mission: `${industry} at ${b.tile_x},${b.tile_y}` },
        treasury_cents: 100000,
        building_id: b.id,
        industry,
      })
      .returning({
        id: schema.company.id,
        name: schema.company.name,
        industry: schema.company.industry,
        building_id: schema.company.building_id,
      });
    companyRows.push(c!);
  }
  log.info({ count: companyRows.length }, 'inserted companies');

  // agents
  const rng = mulberry32(1234);
  const count = env().SIM_AGENT_COUNT;
  const homeCandidates = buildingRows.filter((b) => b.kind === 'house' || b.kind === 'apartment');
  const createdAgents: Array<{ id: string; name: string; profile: ProfessionProfile; assigned: boolean }> = [];
  for (let i = 0; i < count; i++) {
    const home = homeCandidates[Math.floor(rng() * homeCandidates.length)];
    const pos = home ? { x: home.tile_x + 0.5, y: home.tile_y + 0.5 } : { x: 30, y: 30 };
    const profile = pickProfession(i, rng);
    const ageYears = 18 + Math.floor(rng() * 50);
    const [created] = await db
      .insert(schema.agent)
      .values({
        name: genName(rng),
        born_at: new Date(Date.now() - ageYears * 365 * 86400_000),
        age_years: ageYears,
        traits: applyProfessionBias(genTraits(rng), profile),
        needs: genStarterNeeds(),
        occupation: profile.title,
        employer_id: null,
        home_id: home?.id ?? null,
        balance_cents: profile.starting_cash_cents + Math.floor(rng() * 3500),
        status: 'alive',
        portrait_seed: `seed-${i}-${Math.floor(rng() * 1e9)}`,
        pos_x: pos.x,
        pos_y: pos.y,
        target_x: pos.x,
        target_y: pos.y,
        state: 'idle',
      })
      .returning({ id: schema.agent.id, name: schema.agent.name });
    createdAgents.push({ id: created!.id, name: created!.name, profile, assigned: false });
    // starter inventory: 10 food, 5 water — enough runway to act on hunger
    await db.insert(schema.inventory).values([
      { owner_kind: 'agent', owner_id: created!.id, item_id: 1, qty: 10 },
      { owner_kind: 'agent', owner_id: created!.id, item_id: 2, qty: 5 },
    ]);
    await db.insert(schema.agent_memory).values({
      agent_id: created!.id,
      kind: 'belief',
      summary: `${created!.name} thinks of themself as a ${profile.title.toLowerCase()} with ${profile.skill_tags.join(', ')} skills.`,
      salience: 0.75,
      source_event_ids: [],
    });
  }
  log.info({ count }, 'inserted agents');

  for (const company of companyRows) {
    const founder = takeBestFounder(createdAgents, company.industry);
    if (!founder) continue;
    await db.update(schema.company).set({ founder_id: founder.id }).where(sql`${schema.company.id} = ${company.id}`);
    await db.insert(schema.job).values({
      agent_id: founder.id,
      company_id: company.id,
      role: 'founder',
      wage_cents: Math.max(founder.profile.wage_cents, 2200),
    });
    await db.update(schema.agent).set({ employer_id: company.id }).where(sql`${schema.agent.id} = ${founder.id}`);
    founder.assigned = true;
    await db.insert(schema.world_event).values({
      kind: 'company_founded',
      actor_ids: [founder.id, company.id],
      importance: 7,
      payload: { name: company.name, founder: founder.name, industry: company.industry },
    });
  }

  for (const agent of createdAgents.filter((a) => !a.assigned)) {
    let company: { id: string; name: string; industry: string | null; building_id: string | null } | null = null;
    for (const candidate of rankedCompaniesFor(agent.profile, companyRows)) {
      const workers = await db.execute<{ n: number }>(
        sql`SELECT COUNT(*)::int AS n FROM ${schema.job} WHERE company_id=${candidate.id} AND ended_at IS NULL`,
      );
      if (Number(workers[0]?.n ?? 0) < 5) {
        company = candidate;
        break;
      }
    }
    if (!company) continue;
    await db.insert(schema.job).values({
      agent_id: agent.id,
      company_id: company.id,
      role: agent.profile.role,
      wage_cents: agent.profile.wage_cents,
    });
    await db.update(schema.agent).set({ employer_id: company.id }).where(sql`${schema.agent.id} = ${agent.id}`);
    agent.assigned = true;
    await db.insert(schema.world_event).values({
      kind: 'agent_hired',
      actor_ids: [agent.id, company.id],
      importance: 4,
      payload: { role: agent.profile.role, company: company.name, wage_cents: agent.profile.wage_cents },
    });
  }

  const [mayor] = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, name FROM ${schema.agent}
    WHERE status = 'alive'
    ORDER BY ((traits->>'ambition')::float + (traits->>'sociability')::float + balance_cents / 50000.0) DESC
    LIMIT 1
  `);
  const government = {
    mayor_id: mayor?.id ?? null,
    mayor_name: mayor?.name ?? null,
    treasury_cents: 250000,
    tax_rate_bps: 850,
    election_id: 'founding-election',
    next_election_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    turnout: null,
  };
  await db.insert(schema.city_state).values({ key: 'government', value: government });
  await db.insert(schema.ledger_entry).values({
    debit_kind: 'city',
    debit_id: CITY_TREASURY_ID,
    credit_kind: 'city',
    credit_id: CITY_TREASURY_ID,
    amount_cents: 250000,
    reason: 'founding_treasury',
  });
  await db.insert(schema.world_event).values({
    kind: 'city_founded',
    actor_ids: mayor?.id ? [mayor.id] : [],
    importance: 8,
    payload: government,
  });
  await ensureEquityMarket();

  log.info('seed complete');
}

main()
  .catch((e) => {
    log.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));

function industryForBuilding(kind: string): string {
  switch (kind) {
    case 'bank':
      return 'bank';
    case 'office':
      return 'office';
    case 'town_hall':
      return 'town_hall';
    case 'court':
      return 'court';
    case 'jail':
      return 'jail';
    case 'temple':
      return 'temple';
    default:
      return kind;
  }
}

function companyNameFor(kind: string, id: string, rng: () => number): string {
  const district = pickOne(['Northbank', 'Riverside', 'Canal Row', 'Market Street', 'Old Mill', 'Civic Quarter'], rng);
  const suffix = id.slice(0, 3).toUpperCase();
  switch (kind) {
    case 'farm':
      return `${district} Farms ${suffix}`;
    case 'factory':
      return `${district} Foundry ${suffix}`;
    case 'water_works':
      return `${district} Waterworks ${suffix}`;
    case 'power_plant':
      return `${district} Power & Light ${suffix}`;
    case 'shop':
      return `${district} Market ${suffix}`;
    case 'bar':
      return `${district} Public House ${suffix}`;
    case 'bank':
      return 'First Bank & Exchange';
    case 'office':
      return 'Riverside Brokerage';
    case 'town_hall':
      return 'Civic Works Office';
    case 'court':
      return 'Riverside Legal Service';
    case 'jail':
      return 'Civic Security Bureau';
    case 'temple':
      return 'Old Temple Trust';
    default:
      return `${district} Works ${suffix}`;
  }
}

function pickOne<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)]!;
}

function rngForName(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return mulberry32(h >>> 0);
}

function takeBestFounder(
  agents: Array<{ id: string; name: string; profile: ProfessionProfile; assigned: boolean }>,
  industry: string | null,
) {
  const candidate = agents.find((a) => !a.assigned && industry && a.profile.industries.includes(industry));
  return candidate ?? null;
}

function rankedCompaniesFor(
  profile: ProfessionProfile,
  companies: Array<{ id: string; name: string; industry: string | null; building_id: string | null }>,
) {
  return [...companies].sort((a, b) => scoreCompany(profile, b) - scoreCompany(profile, a));
}

function scoreCompany(
  profile: ProfessionProfile,
  company: { id: string; name: string; industry: string | null; building_id: string | null },
): number {
  if (company.industry && profile.industries.includes(company.industry)) return 10;
  if (company.industry === 'office') return 2;
  return 0;
}
