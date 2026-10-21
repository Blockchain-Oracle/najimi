-- Removal only: the business and night tables go; users, runs and the Qloo cache stay.
-- Hand-edited from drizzle-kit's output: every drop is IF EXISTS (a CASCADE table drop already
-- removes the foreign keys, and a failing explicit drop would roll back the whole batch), and
-- "areas" (created by an unshipped local-only migration) is dropped too.
DROP TABLE IF EXISTS "areas" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "business_facts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "qloo_matches" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "people_reports" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "businesses" CASCADE;--> statement-breakpoint
ALTER TABLE "runs" DROP CONSTRAINT IF EXISTS "runs_business_id_businesses_id_fk";--> statement-breakpoint
ALTER TABLE "llm_calls" DROP CONSTRAINT IF EXISTS "llm_calls_business_id_businesses_id_fk";--> statement-breakpoint
ALTER TABLE "qloo_calls" DROP CONSTRAINT IF EXISTS "qloo_calls_business_id_businesses_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "runs_business_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "llm_calls_business_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "qloo_calls_business_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_calls_created_idx" ON "llm_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qloo_calls_created_idx" ON "qloo_calls" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN IF EXISTS "business_id";--> statement-breakpoint
ALTER TABLE "llm_calls" DROP COLUMN IF EXISTS "business_id";--> statement-breakpoint
ALTER TABLE "qloo_calls" DROP COLUMN IF EXISTS "business_id";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."business_kind";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."business_status";
