ALTER TABLE "runs" ADD COLUMN "chat_id" uuid;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "tool_call_id" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "subject" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD COLUMN "chat_id" uuid;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD COLUMN "tool_calls" integer;--> statement-breakpoint
ALTER TABLE "qloo_calls" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "qloo_calls" ADD COLUMN "chat_id" uuid;--> statement-breakpoint
ALTER TABLE "qloo_calls" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qloo_calls" ADD CONSTRAINT "qloo_calls_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_chat_idx" ON "runs" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "llm_calls_user_idx" ON "llm_calls" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "qloo_calls_user_idx" ON "qloo_calls" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "qloo_calls_chat_idx" ON "qloo_calls" USING btree ("chat_id","created_at");