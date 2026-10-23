CREATE TABLE "post_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"url" text,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "connector_sessions" ADD COLUMN "likes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "connector_sessions" ADD COLUMN "posts" text DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "post_drafts" ADD CONSTRAINT "post_drafts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_drafts_user_idx" ON "post_drafts" USING btree ("user_id","created_at");