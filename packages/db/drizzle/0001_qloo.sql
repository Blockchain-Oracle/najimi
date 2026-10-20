CREATE TABLE "qloo_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"params" jsonb NOT NULL,
	"status" integer NOT NULL,
	"body" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qloo_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid,
	"run_id" uuid,
	"purpose" text,
	"path" text NOT NULL,
	"params" jsonb NOT NULL,
	"cache_key" text NOT NULL,
	"status" integer,
	"ms" integer,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"result_count" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qloo_calls" ADD CONSTRAINT "qloo_calls_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qloo_calls" ADD CONSTRAINT "qloo_calls_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "qloo_calls_business_idx" ON "qloo_calls" USING btree ("business_id","created_at");