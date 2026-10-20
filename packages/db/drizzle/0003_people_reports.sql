CREATE TABLE "people_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"run_id" uuid,
	"status" text DEFAULT 'building' NOT NULL,
	"basis" jsonb NOT NULL,
	"domains" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"demographics" jsonb,
	"heatmap" jsonb,
	"vocabulary" jsonb,
	"rising" jsonb,
	"compare" jsonb,
	"error" text,
	"share_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_reports_shareToken_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "people_reports" ADD CONSTRAINT "people_reports_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_reports" ADD CONSTRAINT "people_reports_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_reports_business_idx" ON "people_reports" USING btree ("business_id","created_at");