CREATE TABLE "export_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"nudged_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "export_requests_user_platform" ON "export_requests" USING btree ("user_id","platform");--> statement-breakpoint
CREATE INDEX "export_requests_ready_idx" ON "export_requests" USING btree ("ready_at");