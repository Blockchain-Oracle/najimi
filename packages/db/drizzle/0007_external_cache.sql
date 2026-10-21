CREATE TABLE "external_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"body" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
