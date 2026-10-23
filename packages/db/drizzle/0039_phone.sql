ALTER TABLE "user_prefs" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD COLUMN "phone_confirmed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "user_prefs_phone_idx" ON "user_prefs" USING btree ("phone") WHERE phone_confirmed_at is not null;