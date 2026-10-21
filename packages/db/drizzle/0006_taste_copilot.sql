CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"person_id" uuid,
	"title" text,
	"locale" text NOT NULL,
	"mode" text DEFAULT 'ask' NOT NULL,
	"workflow_id" uuid,
	"status" text DEFAULT 'idle' NOT NULL,
	"turn_started_at" timestamp with time zone,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"forked_from_chat_id" uuid,
	"forked_at_message_id" text,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"token" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_days" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"turns" integer DEFAULT 0 NOT NULL,
	"images" integer DEFAULT 0 NOT NULL,
	"videos" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "workflow_favourites" (
	"user_id" text NOT NULL,
	"workflow_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_favourites_user_id_workflow_id_pk" PRIMARY KEY("user_id","workflow_id")
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"needs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"instructions" text NOT NULL,
	"cover_creation_id" uuid,
	"public" boolean DEFAULT false NOT NULL,
	"runs_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"media_job_id" uuid,
	"chat_id" uuid,
	"person_id" uuid,
	"kind" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"title" text,
	"prompt" text NOT NULL,
	"words" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_upload_id" uuid,
	"source_creation_id" uuid,
	"s3_key" text,
	"display_key" text,
	"thumb_key" text,
	"poster_key" text,
	"mime" text,
	"width" integer,
	"height" integer,
	"duration_s" real,
	"public" boolean DEFAULT false NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"chat_id" uuid,
	"tool_call_id" text,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"provider_request_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_id" uuid,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"s3_key" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"qloo_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"weight" integer DEFAULT 5 NOT NULL,
	"sparse_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"is_self" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"city_lat" double precision,
	"city_lon" double precision,
	"locale" text,
	"age_band" text,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"excluded_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"qloo_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tastes" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"loves_key" text,
	"words" jsonb,
	"picks" jsonb,
	"bridges" jsonb,
	"computed_at" timestamp with time zone,
	"run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "user_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"locale" text,
	"mode" text DEFAULT 'ask' NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_favourites" ADD CONSTRAINT "workflow_favourites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_favourites" ADD CONSTRAINT "workflow_favourites_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creations" ADD CONSTRAINT "creations_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creations" ADD CONSTRAINT "creations_media_job_id_media_jobs_id_fk" FOREIGN KEY ("media_job_id") REFERENCES "public"."media_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creations" ADD CONSTRAINT "creations_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creations" ADD CONSTRAINT "creations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creations" ADD CONSTRAINT "creations_source_upload_id_uploads_id_fk" FOREIGN KEY ("source_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD CONSTRAINT "media_jobs_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD CONSTRAINT "media_jobs_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD CONSTRAINT "media_jobs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loves" ADD CONSTRAINT "loves_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_picks" ADD CONSTRAINT "saved_picks_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tastes" ADD CONSTRAINT "tastes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tastes" ADD CONSTRAINT "tastes_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD CONSTRAINT "user_prefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chats_owner_active_idx" ON "chats" USING btree ("owner_id","last_active_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shares_token_idx" ON "shares" USING btree ("token");--> statement-breakpoint
CREATE INDEX "shares_ref_idx" ON "shares" USING btree ("ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_slug_idx" ON "workflows" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workflows_owner_idx" ON "workflows" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "creations_owner_idx" ON "creations" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "creations_job_idx" ON "creations" USING btree ("media_job_id");--> statement-breakpoint
CREATE INDEX "media_jobs_status_idx" ON "media_jobs" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "uploads_owner_idx" ON "uploads" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "loves_person_entity_idx" ON "loves" USING btree ("person_id","qloo_id");--> statement-breakpoint
CREATE INDEX "people_owner_idx" ON "people" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "people_one_self_idx" ON "people" USING btree ("owner_id") WHERE "people"."is_self";--> statement-breakpoint
CREATE UNIQUE INDEX "saved_picks_person_entity_idx" ON "saved_picks" USING btree ("person_id","qloo_id");