CREATE TABLE "connector_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"mode" text DEFAULT 'own' NOT NULL,
	"account_id" text NOT NULL,
	"handle" text,
	"name" text,
	"image" text,
	"secret_enc" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"autopilot" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"kind" text NOT NULL,
	"target" text NOT NULL,
	"label" text,
	"item_id" text,
	"status" text NOT NULL,
	"detail" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_sessions" ADD CONSTRAINT "connector_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_actions" ADD CONSTRAINT "social_actions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connector_sessions_owner_idx" ON "connector_sessions" USING btree ("user_id","platform","account_id");--> statement-breakpoint
CREATE INDEX "social_actions_user_idx" ON "social_actions" USING btree ("user_id","platform","created_at");