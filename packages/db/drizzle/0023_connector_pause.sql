ALTER TABLE "connector_sessions" ADD COLUMN "tz" text;--> statement-breakpoint
ALTER TABLE "connector_sessions" ADD COLUMN "paused_until" timestamp with time zone;