import { db, schema } from "@najimi/db"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { uploadIdsOf } from "@/lib/chat/merge"
import { messagesOf, ownedChat } from "@/lib/chat/store"
import { slugFor } from "@/lib/workflows"

const input = z.object({
  chatId: z.uuid().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).default(""),
  /** The steps, in the person's own words. A run sends them as the person's first message. */
  instructions: z.string().trim().min(10).max(2000),
  public: z.boolean().default(false),
})

/** Save a workflow of one's own (T15), usually from a chat that went well. */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const userId = auth.session.user.id
  const { chatId, ...data } = parsed.data
  const chat = chatId ? await ownedChat(userId, chatId) : null
  if (chatId && !chat) return fail("Unknown chat", 404)
  // A chat that started from a photo makes a workflow that asks for one.
  const photo = chat
    ? messagesOf(chat).some((m) => m.role === "user" && uploadIdsOf(m).length)
    : false
  const [row] = await db
    .insert(schema.workflows)
    .values({
      ...data,
      slug: slugFor(data.name),
      ownerId: userId,
      category: "mine",
      needs: photo ? { photo: true } : {},
    })
    .returning({ id: schema.workflows.id, slug: schema.workflows.slug })
  if (!row) return fail("Couldn't save it", 500)
  return json(row, 201)
}
