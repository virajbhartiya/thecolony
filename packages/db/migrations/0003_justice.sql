CREATE TABLE IF NOT EXISTS "legal_status" (
	"agent_id" uuid PRIMARY KEY NOT NULL,
	"warrants" integer DEFAULT 0 NOT NULL,
	"debts_cents" bigint DEFAULT 0 NOT NULL,
	"bounty_cents" bigint DEFAULT 0 NOT NULL,
	"jail_until" timestamp with time zone,
	"parole_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_status_warrants_idx" ON "legal_status" USING btree ("warrants");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_status_jail_until_idx" ON "legal_status" USING btree ("jail_until");
