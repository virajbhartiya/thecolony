import type { FastifyInstance } from 'fastify';
import { db, schema } from '@thecolony/db';
import { desc, eq, sql } from 'drizzle-orm';

export async function registerCityRoutes(app: FastifyInstance) {
  app.get('/v1/buildings', async () => {
    const buildings = await db
      .select({
        id: schema.building.id,
        name: schema.building.name,
        kind: schema.building.kind,
        zone_kind: schema.building.zone_kind,
        tile_x: schema.building.tile_x,
        tile_y: schema.building.tile_y,
        capacity: schema.building.capacity,
        rent_cents: schema.building.rent_cents,
        condition: schema.building.condition,
      })
      .from(schema.building)
      .orderBy(schema.building.kind, schema.building.name);
    return { buildings };
  });

  app.get<{ Params: { id: string } }>('/v1/building/:id', async (req, reply) => {
    const id = req.params.id;
    const [building] = await db.select().from(schema.building).where(eq(schema.building.id, id)).limit(1);
    if (!building) return reply.code(404).send({ error: 'not found' });

    const company = (
      await db
        .select({
          id: schema.company.id,
          name: schema.company.name,
          industry: schema.company.industry,
          treasury_cents: schema.company.treasury_cents,
          founder_id: schema.company.founder_id,
          charter: schema.company.charter,
        })
        .from(schema.company)
        .where(eq(schema.company.building_id, id))
        .limit(1)
    )[0] ?? null;

    const occupants = await db.execute<{
      id: string;
      name: string;
      occupation: string | null;
      state: string;
      balance_cents: number;
    }>(sql`
      SELECT id, name, occupation, state, balance_cents
      FROM ${schema.agent}
      WHERE status <> 'dead'
        AND (
          home_id = ${id}
          OR (
            pos_x >= ${building.tile_x}
            AND pos_x <= ${building.tile_x + building.tile_w}
            AND pos_y >= ${building.tile_y}
            AND pos_y <= ${building.tile_y + building.tile_h}
          )
        )
      ORDER BY occupation NULLS LAST, name
      LIMIT 50
    `);

    const employees = company
      ? await db.execute<{
          id: string;
          name: string;
          occupation: string | null;
          role: string;
          wage_cents: number;
        }>(sql`
          SELECT a.id, a.name, a.occupation, j.role, j.wage_cents
          FROM ${schema.job} j
          JOIN ${schema.agent} a ON a.id = j.agent_id
          WHERE j.company_id = ${company.id} AND j.ended_at IS NULL
          ORDER BY j.role, a.name
        `)
      : [];

    const inventory = company
      ? await db.execute<{ key: string; qty: number }>(sql`
          SELECT it.key, i.qty
          FROM ${schema.inventory} i
          JOIN ${schema.item_type} it ON it.id = i.item_id
          WHERE i.owner_kind = 'company' AND i.owner_id = ${company.id}
          ORDER BY it.key
        `)
      : [];

    const transactions = await db
      .select()
      .from(schema.ledger_entry)
      .where(company ? sql`${schema.ledger_entry.debit_id} = ${company.id} OR ${schema.ledger_entry.credit_id} = ${company.id} OR ${schema.ledger_entry.credit_id} = ${id}` : eq(schema.ledger_entry.credit_id, id))
      .orderBy(desc(schema.ledger_entry.t))
      .limit(30);

    return { building, company, occupants, employees, inventory, transactions };
  });

  app.get('/v1/leaderboards', async () => {
    const richest = await db
      .select({
        id: schema.agent.id,
        name: schema.agent.name,
        occupation: schema.agent.occupation,
        balance_cents: schema.agent.balance_cents,
        status: schema.agent.status,
        portrait_seed: schema.agent.portrait_seed,
      })
      .from(schema.agent)
      .orderBy(desc(schema.agent.balance_cents))
      .limit(20);

    const loved = await db.execute<{ id: string; name: string; occupation: string | null; score: number }>(sql`
      SELECT a.id, a.name, a.occupation, COALESCE(SUM(r.affinity), 0)::int AS score
      FROM ${schema.agent} a
      LEFT JOIN ${schema.agent_relationship} r ON r.obj_id = a.id
      WHERE a.status <> 'dead'
      GROUP BY a.id, a.name, a.occupation
      ORDER BY score DESC, a.name
      LIMIT 20
    `);

    const hated = await db.execute<{ id: string; name: string; occupation: string | null; score: number }>(sql`
      SELECT a.id, a.name, a.occupation, COALESCE(SUM(r.affinity), 0)::int AS score
      FROM ${schema.agent} a
      LEFT JOIN ${schema.agent_relationship} r ON r.obj_id = a.id
      WHERE a.status <> 'dead'
      GROUP BY a.id, a.name, a.occupation
      ORDER BY score ASC, a.name
      LIMIT 20
    `);

    const notorious = await db.execute<{ id: string; name: string; occupation: string | null; incidents: number; severity: number }>(sql`
      SELECT a.id, a.name, a.occupation, COUNT(i.id)::int AS incidents, COALESCE(SUM(i.severity), 0)::int AS severity
      FROM ${schema.agent} a
      JOIN ${schema.incident} i ON i.perp_id = a.id
      GROUP BY a.id, a.name, a.occupation
      ORDER BY severity DESC, incidents DESC
      LIMIT 20
    `);

    return { richest, loved, hated, notorious };
  });

  app.get('/v1/market', async () => {
    const companies = await db.execute<{
      id: string;
      name: string;
      industry: string | null;
      ticker: string | null;
      treasury_cents: number;
      founder_id: string | null;
      workers: number;
      payroll_cents: number;
      inventory_qty: number;
      shares_outstanding: number;
      last_price_cents: number | null;
      previous_price_cents: number | null;
      open_orders: number;
    }>(sql`
      WITH worker_stats AS (
        SELECT company_id, COUNT(*)::int AS workers, COALESCE(SUM(wage_cents), 0)::bigint AS payroll_cents
        FROM ${schema.job}
        WHERE ended_at IS NULL
        GROUP BY company_id
      ),
      inventory_stats AS (
        SELECT owner_id AS company_id, COALESCE(SUM(qty), 0)::int AS inventory_qty
        FROM ${schema.inventory}
        WHERE owner_kind = 'company'
        GROUP BY owner_id
      ),
      share_stats AS (
        SELECT company_id, COALESCE(SUM(shares), 0)::bigint AS shares_outstanding
        FROM ${schema.share_holding}
        GROUP BY company_id
      ),
      price_rank AS (
        SELECT asset, price_cents, t, ROW_NUMBER() OVER (PARTITION BY asset ORDER BY t DESC) AS rn
        FROM ${schema.price_observation}
      ),
      price_stats AS (
        SELECT asset,
          MAX(price_cents) FILTER (WHERE rn = 1)::bigint AS last_price_cents,
          MAX(price_cents) FILTER (WHERE rn = 2)::bigint AS previous_price_cents
        FROM price_rank
        WHERE rn <= 2
        GROUP BY asset
      ),
      order_stats AS (
        SELECT ref_id AS company_id, COUNT(*)::int AS open_orders
        FROM ${schema.market_order}
        WHERE status IN ('open','partial') AND qty > filled_qty
        GROUP BY ref_id
      )
      SELECT c.id, c.name, c.industry, c.ticker, c.treasury_cents, c.founder_id,
        COALESCE(ws.workers, 0)::int AS workers,
        COALESCE(ws.payroll_cents, 0)::bigint AS payroll_cents,
        COALESCE(inv.inventory_qty, 0)::int AS inventory_qty,
        COALESCE(ss.shares_outstanding, 0)::bigint AS shares_outstanding,
        ps.last_price_cents,
        ps.previous_price_cents,
        COALESCE(os.open_orders, 0)::int AS open_orders
      FROM ${schema.company} c
      LEFT JOIN worker_stats ws ON ws.company_id = c.id
      LEFT JOIN inventory_stats inv ON inv.company_id = c.id
      LEFT JOIN share_stats ss ON ss.company_id = c.id
      LEFT JOIN price_stats ps ON ps.asset = ('shares:' || c.id::text)
      LEFT JOIN order_stats os ON os.company_id = c.id
      WHERE c.dissolved_at IS NULL AND c.building_id IS NOT NULL
      ORDER BY c.treasury_cents DESC
    `);

    const recentLedger = await db
      .select()
      .from(schema.ledger_entry)
      .orderBy(desc(schema.ledger_entry.t))
      .limit(60);
    const orders = await db.select().from(schema.market_order).orderBy(desc(schema.market_order.t)).limit(50);
    const trades = await db
      .select()
      .from(schema.price_observation)
      .orderBy(desc(schema.price_observation.t))
      .limit(60);
    return { companies, recentLedger, orders, trades };
  });

  app.get('/v1/crime', async () => {
    const incidents = await db
      .select()
      .from(schema.incident)
      .orderBy(desc(schema.incident.t))
      .limit(100);
    const topCriminals = await db.execute<{ id: string; name: string; occupation: string | null; incidents: number; severity: number }>(sql`
      SELECT a.id, a.name, a.occupation, COUNT(i.id)::int AS incidents, COALESCE(SUM(i.severity), 0)::int AS severity
      FROM ${schema.agent} a
      JOIN ${schema.incident} i ON i.perp_id = a.id
      GROUP BY a.id, a.name, a.occupation
      ORDER BY severity DESC, incidents DESC
      LIMIT 20
    `);
    return { incidents, topCriminals };
  });

  app.get('/v1/groups', async () => {
    const groups = await db.execute<{
      id: string;
      name: string;
      kind: string;
      founder_id: string;
      founder_name: string | null;
      doctrine: string;
      member_count: number;
    }>(sql`
      SELECT g.id, g.name, g.kind, g.founder_id, a.name AS founder_name, g.doctrine,
        COUNT(m.agent_id)::int AS member_count
      FROM ${schema.ideology_group} g
      LEFT JOIN ${schema.agent} a ON a.id = g.founder_id
      LEFT JOIN ${schema.group_membership} m ON m.group_id = g.id
      GROUP BY g.id, g.name, g.kind, g.founder_id, a.name, g.doctrine
      ORDER BY member_count DESC, g.founded_at DESC
    `);
    return { groups };
  });

  app.get('/v1/history', async () => {
    const deaths = await db.execute<{
      agent_id: string;
      name: string | null;
      t: string;
      cause: string;
      eulogy: string | null;
    }>(sql`
      SELECT d.agent_id, a.name, d.t, d.cause, d.eulogy
      FROM ${schema.death_event} d
      LEFT JOIN ${schema.agent} a ON a.id = d.agent_id
      ORDER BY d.t DESC
      LIMIT 80
    `);

    const timeline = await db
      .select()
      .from(schema.world_event)
      .where(sql`${schema.world_event.importance} >= 7`)
      .orderBy(desc(schema.world_event.t))
      .limit(100);
    return { deaths, timeline };
  });

  app.get('/v1/news', async () => {
    const events = await db
      .select()
      .from(schema.world_event)
      .where(sql`${schema.world_event.importance} >= 5`)
      .orderBy(desc(schema.world_event.t))
      .limit(60);

    const headlines = events.slice(0, 12).map((event) => ({
      id: event.id,
      t: event.t,
      title: headlineFor(event.kind, event.payload as Record<string, unknown>),
      kind: event.kind,
      importance: event.importance,
      payload: event.payload,
    }));

    return { headlines, events };
  });
}

function headlineFor(kind: string, payload: Record<string, unknown>): string {
  switch (kind) {
    case 'mayor_elected':
      return `${String(payload.mayor_name ?? 'A candidate')} wins City Hall`;
    case 'city_tax_collected':
      return `City Hall collects $${money(payload.amount_cents)} in taxes`;
    case 'company_founded':
      return `${String(payload.name ?? 'A company')} opens for business`;
    case 'job_posted':
      return `${String(payload.company ?? 'A company')} is hiring ${String(payload.role ?? 'workers')}`;
    case 'agent_hired':
      return `${String(payload.company ?? 'A company')} hires a ${String(payload.role ?? 'worker')}`;
    case 'agent_fired':
      return `${String(payload.company ?? 'A company')} fires a ${String(payload.role ?? 'worker')}`;
    case 'agent_evicted':
      return `Eviction at $${money(payload.rent)} daily rent`;
    case 'agent_died':
      return `${String(payload.name ?? 'A citizen')} dies from ${String(payload.cause ?? 'unknown causes')}`;
    case 'incident_theft':
      return `Theft reported: $${money(payload.amount_cents)} stolen`;
    default:
      return kind.replaceAll('_', ' ');
  }
}

function money(value: unknown): string {
  return (Number(value ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
