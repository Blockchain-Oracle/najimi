ALTER TABLE "user_prefs" ADD COLUMN "email_prefs" jsonb DEFAULT '{"weekly":true,"news":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD COLUMN "welcomed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD COLUMN "digest_at" timestamp with time zone;