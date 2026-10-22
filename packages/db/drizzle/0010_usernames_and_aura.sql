ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "display_username" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "aura" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");