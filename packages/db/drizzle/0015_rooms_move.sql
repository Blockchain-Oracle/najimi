-- Every chat becomes a room its owner is in, and its messages become rows (one per message, in
-- the order they were said), before the old array and the run-only event table go.
INSERT INTO "chat_members" ("chat_id", "user_id", "role")
SELECT "id", "owner_id", 'owner' FROM "chats"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "messages" ("id", "chat_id", "role", "author_id", "parts", "metadata", "status", "created_at", "updated_at")
SELECT
  m->>'id',
  c."id",
  COALESCE(m->>'role', 'assistant'),
  CASE WHEN m->>'role' = 'user' THEN c."owner_id" END,
  COALESCE(m->'parts', '[]'::jsonb),
  m->'metadata',
  'done',
  c."created_at" + (t.ord * interval '1 millisecond'),
  c."updated_at"
FROM "chats" c, jsonb_array_elements(c."messages") WITH ORDINALITY AS t(m, ord)
WHERE m->>'id' IS NOT NULL
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
DROP TABLE "run_events" CASCADE;--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN "messages";
