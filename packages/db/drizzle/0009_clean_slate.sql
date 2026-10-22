-- S00 clean slate: the taste copilot's workflows, chats and "people I make for" go; users and their
-- own loves stay. Creations keep their files (chat_id is set null) until "delete all my data".
DELETE FROM "people" WHERE "is_self" = false;--> statement-breakpoint
DELETE FROM "chats";--> statement-breakpoint
ALTER TABLE "chats" DROP CONSTRAINT IF EXISTS "chats_workflow_id_workflows_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_favourites" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflows" CASCADE;--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN IF EXISTS "workflow_id";--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN IF EXISTS "forked_from_chat_id";--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN IF EXISTS "forked_at_message_id";--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN IF EXISTS "age_band";--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN IF EXISTS "constraints";
