CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"born_at" timestamp with time zone NOT NULL,
	"died_at" timestamp with time zone,
	"age_years" integer DEFAULT 18 NOT NULL,
	"traits" jsonb NOT NULL,
	"needs" jsonb NOT NULL,
	"occupation" text,
	"employer_id" uuid,
	"home_id" uuid,
	"balance_cents" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'alive' NOT NULL,
	"portrait_seed" text NOT NULL,
	"pos_x" real DEFAULT 0 NOT NULL,
	"pos_y" real DEFAULT 0 NOT NULL,
	"target_x" real DEFAULT 0 NOT NULL,
	"target_y" real DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'idle' NOT NULL,
	"next_decision_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memory" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"salience" real DEFAULT 0.5 NOT NULL,
	"embedding" vector(1536),
	"source_event_ids" bigint[],
	"superseded_by" bigint
);
--> statement-breakpoint
CREATE TABLE "agent_relationship" (
	"subj_id" uuid NOT NULL,
	"obj_id" uuid NOT NULL,
	"affinity" integer DEFAULT 0 NOT NULL,
	"trust" integer DEFAULT 0 NOT NULL,
	"last_interaction_t" timestamp with time zone,
	"tags" text[],
	CONSTRAINT "agent_relationship_subj_id_obj_id_pk" PRIMARY KEY("subj_id","obj_id")
);
--> statement-breakpoint
CREATE TABLE "birth_event" (
	"agent_id" uuid PRIMARY KEY NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"parent_ids" uuid[],
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "building" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"zone_kind" text NOT NULL,
	"name" text NOT NULL,
	"tile_x" integer NOT NULL,
	"tile_y" integer NOT NULL,
	"tile_w" integer DEFAULT 2 NOT NULL,
	"tile_h" integer DEFAULT 2 NOT NULL,
	"owner_kind" text DEFAULT 'city' NOT NULL,
	"owner_id" uuid,
	"capacity" integer DEFAULT 4 NOT NULL,
	"rent_cents" bigint DEFAULT 0 NOT NULL,
	"condition" smallint DEFAULT 100 NOT NULL,
	"sprite_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"founder_id" uuid,
	"founded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dissolved_at" timestamp with time zone,
	"charter" jsonb NOT NULL,
	"treasury_cents" bigint DEFAULT 0 NOT NULL,
	"ticker" text,
	"building_id" uuid,
	"industry" text
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "death_event" (
	"agent_id" uuid PRIMARY KEY NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"cause" text NOT NULL,
	"last_words" text,
	"eulogy" text
);
--> statement-breakpoint
CREATE TABLE "group_membership" (
	"agent_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_membership_agent_id_group_id_pk" PRIMARY KEY("agent_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "ideology_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"founder_id" uuid NOT NULL,
	"founded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"doctrine" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"perp_id" uuid,
	"victim_id" uuid,
	"severity" smallint DEFAULT 1 NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"evidence_event_ids" bigint[]
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"owner_kind" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"item_id" smallint NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "inventory_owner_kind_owner_id_item_id_pk" PRIMARY KEY("owner_kind","owner_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "item_type" (
	"id" smallint PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"base_value_cents" bigint NOT NULL,
	"perishable" boolean DEFAULT false NOT NULL,
	CONSTRAINT "item_type_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role" text NOT NULL,
	"wage_cents" bigint NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"debit_kind" text NOT NULL,
	"debit_id" uuid NOT NULL,
	"credit_kind" text NOT NULL,
	"credit_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reason" text NOT NULL,
	"event_id" bigint
);
--> statement-breakpoint
CREATE TABLE "market_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"asset" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"ref_id" uuid,
	"price_cents" bigint NOT NULL,
	"qty" integer NOT NULL,
	"ttl_t" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"actor_ids" uuid[],
	"location_id" uuid,
	"importance" smallint DEFAULT 3 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_status_idx" ON "agent" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_next_decision_idx" ON "agent" USING btree ("next_decision_at");--> statement-breakpoint
CREATE INDEX "memory_agent_idx" ON "agent_memory" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "memory_t_idx" ON "agent_memory" USING btree ("t");--> statement-breakpoint
CREATE INDEX "rel_subj_idx" ON "agent_relationship" USING btree ("subj_id");--> statement-breakpoint
CREATE INDEX "rel_obj_idx" ON "agent_relationship" USING btree ("obj_id");--> statement-breakpoint
CREATE INDEX "building_kind_idx" ON "building" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "inc_perp_idx" ON "incident" USING btree ("perp_id");--> statement-breakpoint
CREATE INDEX "job_agent_idx" ON "job" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "job_company_idx" ON "job" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ledger_t_idx" ON "ledger_entry" USING btree ("t");--> statement-breakpoint
CREATE INDEX "ledger_debit_idx" ON "ledger_entry" USING btree ("debit_id");--> statement-breakpoint
CREATE INDEX "ledger_credit_idx" ON "ledger_entry" USING btree ("credit_id");--> statement-breakpoint
CREATE INDEX "order_asset_idx" ON "market_order" USING btree ("asset");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "market_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "msg_conv_idx" ON "message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "event_t_idx" ON "world_event" USING btree ("t");--> statement-breakpoint
CREATE INDEX "event_kind_idx" ON "world_event" USING btree ("kind");