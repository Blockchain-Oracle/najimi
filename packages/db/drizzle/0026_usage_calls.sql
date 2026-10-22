ALTER TABLE "usage_days" ADD COLUMN "calls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_days" ADD COLUMN "holds" integer DEFAULT 0 NOT NULL;