ALTER TABLE "messages" DROP CONSTRAINT "messages_author_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "game_rounds" DROP CONSTRAINT "game_rounds_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "radar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;