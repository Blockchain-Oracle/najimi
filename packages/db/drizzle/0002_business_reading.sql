CREATE TYPE "public"."business_kind" AS ENUM('place', 'brand', 'artist', 'other');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('reading', 'matching', 'confirm', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "business_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"source_url" text,
	"origin" text DEFAULT 'site' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qloo_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"role" text NOT NULL,
	"entity_id" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"route" text,
	"call_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid,
	"run_id" uuid,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"effort" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"ms" integer,
	"stop_reason" text,
	"refusal_category" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "host" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "status" "business_status" DEFAULT 'reading' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "kind" "business_kind";--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "lon" double precision;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "favicon_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "socials" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "offerings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "comparable_names" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "setup_run_id" uuid;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "business_facts" ADD CONSTRAINT "business_facts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qloo_matches" ADD CONSTRAINT "qloo_matches_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_facts_business_idx" ON "business_facts" USING btree ("business_id","position");--> statement-breakpoint
CREATE INDEX "qloo_matches_business_idx" ON "qloo_matches" USING btree ("business_id","role");--> statement-breakpoint
CREATE INDEX "llm_calls_business_idx" ON "llm_calls" USING btree ("business_id","created_at");