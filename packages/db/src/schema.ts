import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  real,
  jsonb,
  timestamp,
  boolean,
  smallint,
  bigserial,
  index,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((s) => Number(s));
  },
});

export const agent = pgTable(
  'agent',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    born_at: timestamp('born_at', { withTimezone: true }).notNull(),
    died_at: timestamp('died_at', { withTimezone: true }),
    age_years: integer('age_years').notNull().default(18),
    traits: jsonb('traits').notNull(),
    needs: jsonb('needs').notNull(),
    occupation: text('occupation'),
    employer_id: uuid('employer_id'),
    home_id: uuid('home_id'),
    balance_cents: bigint('balance_cents', { mode: 'number' }).notNull().default(0),
    status: text('status').notNull().default('alive'),
    portrait_seed: text('portrait_seed').notNull(),
    pos_x: real('pos_x').notNull().default(0),
    pos_y: real('pos_y').notNull().default(0),
    target_x: real('target_x').notNull().default(0),
    target_y: real('target_y').notNull().default(0),
    state: text('state').notNull().default('idle'),
    next_decision_at: timestamp('next_decision_at', { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    status_idx: index('agent_status_idx').on(t.status),
    next_decision_idx: index('agent_next_decision_idx').on(t.next_decision_at),
  }),
);

export const building = pgTable(
  'building',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: text('kind').notNull(),
    zone_kind: text('zone_kind').notNull(),
    name: text('name').notNull(),
    tile_x: integer('tile_x').notNull(),
    tile_y: integer('tile_y').notNull(),
    tile_w: integer('tile_w').notNull().default(2),
    tile_h: integer('tile_h').notNull().default(2),
    owner_kind: text('owner_kind').notNull().default('city'),
    owner_id: uuid('owner_id'),
    capacity: integer('capacity').notNull().default(4),
    rent_cents: bigint('rent_cents', { mode: 'number' }).notNull().default(0),
    condition: smallint('condition').notNull().default(100),
    sprite_key: text('sprite_key').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    kind_idx: index('building_kind_idx').on(t.kind),
  }),
);

export const agent_memory = pgTable(
  'agent_memory',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    agent_id: uuid('agent_id').notNull(),
    t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
    kind: text('kind').notNull(),
    summary: text('summary').notNull(),
    salience: real('salience').notNull().default(0.5),
    embedding: vector('embedding'),
    source_event_ids: bigint('source_event_ids', { mode: 'number' }).array(),
    superseded_by: bigint('superseded_by', { mode: 'number' }),
  },
  (t) => ({
    agent_idx: index('memory_agent_idx').on(t.agent_id),
    t_idx: index('memory_t_idx').on(t.t),
  }),
);

export const agent_relationship = pgTable(
  'agent_relationship',
  {
    subj_id: uuid('subj_id').notNull(),
    obj_id: uuid('obj_id').notNull(),
    affinity: integer('affinity').notNull().default(0),
    trust: integer('trust').notNull().default(0),
    last_interaction_t: timestamp('last_interaction_t', { withTimezone: true }),
    tags: text('tags').array(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.subj_id, t.obj_id] }),
    subj_idx: index('rel_subj_idx').on(t.subj_id),
    obj_idx: index('rel_obj_idx').on(t.obj_id),
  }),
);

export const item_type = pgTable('item_type', {
  id: smallint('id').primaryKey(),
  key: text('key').notNull().unique(),
  base_value_cents: bigint('base_value_cents', { mode: 'number' }).notNull(),
  perishable: boolean('perishable').notNull().default(false),
});

export const inventory = pgTable(
  'inventory',
  {
    owner_kind: text('owner_kind').notNull(),
    owner_id: uuid('owner_id').notNull(),
    item_id: smallint('item_id').notNull(),
    qty: integer('qty').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.owner_kind, t.owner_id, t.item_id] }),
  }),
);

export const ledger_entry = pgTable(
  'ledger_entry',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
    debit_kind: text('debit_kind').notNull(),
    debit_id: uuid('debit_id').notNull(),
    credit_kind: text('credit_kind').notNull(),
    credit_id: uuid('credit_id').notNull(),
    amount_cents: bigint('amount_cents', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    event_id: bigint('event_id', { mode: 'number' }),
  },
  (t) => ({
    t_idx: index('ledger_t_idx').on(t.t),
    debit_idx: index('ledger_debit_idx').on(t.debit_id),
    credit_idx: index('ledger_credit_idx').on(t.credit_id),
  }),
);

export const price_observation = pgTable(
  'price_observation',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
    asset: text('asset').notNull(),
    item_id: smallint('item_id'),
    location_id: uuid('location_id'),
    price_cents: bigint('price_cents', { mode: 'number' }).notNull(),
    qty: integer('qty').notNull(),
  },
  (t) => ({
    asset_t_idx: index('price_obs_asset_t_idx').on(t.asset, t.t),
    item_t_idx: index('price_obs_item_t_idx').on(t.item_id, t.t),
  }),
);

export const job = pgTable(
  'job',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agent_id: uuid('agent_id').notNull(),
    company_id: uuid('company_id').notNull(),
    role: text('role').notNull(),
    wage_cents: bigint('wage_cents', { mode: 'number' }).notNull(),
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    ended_at: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => ({
    agent_idx: index('job_agent_idx').on(t.agent_id),
    company_idx: index('job_company_idx').on(t.company_id),
  }),
);

export const company = pgTable('company', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  founder_id: uuid('founder_id'),
  founded_at: timestamp('founded_at', { withTimezone: true }).notNull().defaultNow(),
  dissolved_at: timestamp('dissolved_at', { withTimezone: true }),
  charter: jsonb('charter').notNull(),
  treasury_cents: bigint('treasury_cents', { mode: 'number' }).notNull().default(0),
  ticker: text('ticker'),
  building_id: uuid('building_id'),
  industry: text('industry'),
});

export const company_member = pgTable(
  'company_member',
  {
    agent_id: uuid('agent_id').notNull(),
    company_id: uuid('company_id').notNull(),
    role: text('role').notNull(),
    joined_at: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.agent_id, t.company_id, t.role] }),
    company_idx: index('company_member_company_idx').on(t.company_id),
  }),
);

export const share_holding = pgTable(
  'share_holding',
  {
    agent_id: uuid('agent_id').notNull(),
    company_id: uuid('company_id').notNull(),
    shares: bigint('shares', { mode: 'number' }).notNull().default(0),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.agent_id, t.company_id] }),
    company_idx: index('share_holding_company_idx').on(t.company_id),
  }),
);

export const conversation = pgTable('conversation', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: text('kind').notNull(),
  started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  ended_at: timestamp('ended_at', { withTimezone: true }),
});

export const message = pgTable(
  'message',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    conversation_id: uuid('conversation_id').notNull(),
    sender_id: uuid('sender_id').notNull(),
    body: text('body').notNull(),
    t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    conv_idx: index('msg_conv_idx').on(t.conversation_id),
  }),
);

export const ideology_group = pgTable('ideology_group', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  founder_id: uuid('founder_id').notNull(),
  founded_at: timestamp('founded_at', { withTimezone: true }).notNull().defaultNow(),
  doctrine: text('doctrine').notNull(),
});

export const group_membership = pgTable(
  'group_membership',
  {
    agent_id: uuid('agent_id').notNull(),
    group_id: uuid('group_id').notNull(),
    role: text('role').notNull().default('member'),
    joined_at: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.agent_id, t.group_id] }),
  }),
);

export const incident = pgTable(
  'incident',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
    kind: text('kind').notNull(),
    perp_id: uuid('perp_id'),
    victim_id: uuid('victim_id'),
    severity: smallint('severity').notNull().default(1),
    resolved: boolean('resolved').notNull().default(false),
    evidence_event_ids: bigint('evidence_event_ids', { mode: 'number' }).array(),
  },
  (t) => ({
    perp_idx: index('inc_perp_idx').on(t.perp_id),
  }),
);

export const death_event = pgTable('death_event', {
  agent_id: uuid('agent_id').primaryKey(),
  t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
  cause: text('cause').notNull(),
  last_words: text('last_words'),
  eulogy: text('eulogy'),
});

export const birth_event = pgTable('birth_event', {
  agent_id: uuid('agent_id').primaryKey(),
  t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
  parent_ids: uuid('parent_ids').array(),
  kind: text('kind').notNull(),
});

export const world_event = pgTable(
  'world_event',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
    kind: text('kind').notNull(),
    actor_ids: uuid('actor_ids').array(),
    location_id: uuid('location_id'),
    importance: smallint('importance').notNull().default(3),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    t_idx: index('event_t_idx').on(t.t),
    kind_idx: index('event_kind_idx').on(t.kind),
  }),
);

export const market_order = pgTable(
  'market_order',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
    kind: text('kind').notNull(),
    asset: text('asset').notNull(),
    agent_id: uuid('agent_id').notNull(),
    ref_id: uuid('ref_id'),
    price_cents: bigint('price_cents', { mode: 'number' }).notNull(),
    qty: integer('qty').notNull(),
    filled_qty: integer('filled_qty').notNull().default(0),
    ttl_t: timestamp('ttl_t', { withTimezone: true }),
    status: text('status').notNull().default('open'),
  },
  (t) => ({
    asset_idx: index('order_asset_idx').on(t.asset),
    status_idx: index('order_status_idx').on(t.status),
  }),
);

export const city_state = pgTable('city_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const city_vote = pgTable(
  'city_vote',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    election_id: text('election_id').notNull(),
    t: timestamp('t', { withTimezone: true }).notNull().defaultNow(),
    voter_id: uuid('voter_id').notNull(),
    candidate_id: uuid('candidate_id').notNull(),
    weight: smallint('weight').notNull().default(1),
    reason: text('reason').notNull(),
  },
  (t) => ({
    election_idx: index('city_vote_election_idx').on(t.election_id),
    voter_idx: index('city_vote_voter_idx').on(t.voter_id),
  }),
);
