CREATE TABLE "call_blocks" (
	"phone" text PRIMARY KEY NOT NULL,
	"venue" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
