ALTER TABLE "game_answers" ADD COLUMN "guest_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "game_answers_guest_idx" ON "game_answers" USING btree ("round_id","guest_key");