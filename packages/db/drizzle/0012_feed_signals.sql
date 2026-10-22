CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"qloo_id" text NOT NULL,
	"type" text NOT NULL,
	"kind" text NOT NULL,
	"value" double precision,
	"surface" text DEFAULT 'feed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "feed_mix" jsonb;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "feed_cursor" jsonb;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signals_person_time_idx" ON "signals" USING btree ("person_id","created_at");--> statement-breakpoint
CREATE INDEX "signals_person_entity_idx" ON "signals" USING btree ("person_id","qloo_id");