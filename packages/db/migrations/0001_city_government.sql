CREATE TABLE IF NOT EXISTS "city_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "city_vote" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"election_id" text NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"voter_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"weight" smallint DEFAULT 1 NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "city_vote_election_idx" ON "city_vote" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "city_vote_voter_idx" ON "city_vote" USING btree ("voter_id");
