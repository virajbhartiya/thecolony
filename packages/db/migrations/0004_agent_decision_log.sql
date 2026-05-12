CREATE TABLE IF NOT EXISTS "agent_decision_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"agent_id" uuid NOT NULL,
	"source" text NOT NULL,
	"model" text,
	"prompt_hash" text NOT NULL,
	"rng_seed" bigint NOT NULL,
	"agent_snapshot" jsonb NOT NULL,
	"context_snapshot" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"action_kind" text NOT NULL,
	"rationale" text,
	"inner_monologue" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_log_agent_t_idx" ON "agent_decision_log" USING btree ("agent_id","t");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_log_prompt_hash_idx" ON "agent_decision_log" USING btree ("prompt_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_log_action_kind_idx" ON "agent_decision_log" USING btree ("action_kind");
