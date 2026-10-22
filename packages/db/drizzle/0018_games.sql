CREATE TABLE "game_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" text,
	"guest_name" text,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"right" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"chat_id" uuid,
	"subject_id" text,
	"created_by" text,
	"items" jsonb NOT NULL,
	"token" text NOT NULL,
	"daily" boolean DEFAULT false NOT NULL,
	"najimi" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "game_answers" ADD CONSTRAINT "game_answers_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_answers" ADD CONSTRAINT "game_answers_player_id_user_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_subject_id_user_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_answers_player_idx" ON "game_answers" USING btree ("round_id","player_id");--> statement-breakpoint
CREATE INDEX "game_answers_time_idx" ON "game_answers" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_rounds_token_idx" ON "game_rounds" USING btree ("token");--> statement-breakpoint
CREATE INDEX "game_rounds_chat_idx" ON "game_rounds" USING btree ("chat_id","created_at");