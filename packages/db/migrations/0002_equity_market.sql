CREATE TABLE IF NOT EXISTS "price_observation" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"asset" text NOT NULL,
	"item_id" smallint,
	"location_id" uuid,
	"price_cents" bigint NOT NULL,
	"qty" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_obs_asset_t_idx" ON "price_observation" USING btree ("asset","t");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_obs_item_t_idx" ON "price_observation" USING btree ("item_id","t");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_member" (
	"agent_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_member_agent_id_company_id_role_pk" PRIMARY KEY("agent_id","company_id","role")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_member_company_idx" ON "company_member" USING btree ("company_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "share_holding" (
	"agent_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"shares" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_holding_agent_id_company_id_pk" PRIMARY KEY("agent_id","company_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "share_holding_company_idx" ON "share_holding" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "market_order" ADD COLUMN IF NOT EXISTS "filled_qty" integer DEFAULT 0 NOT NULL;
