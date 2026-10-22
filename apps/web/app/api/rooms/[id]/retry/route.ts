import { db, schema } from "@najimi/db"
import { enqueue } from "@najimi/jobs"
import { publish, topic } from "@najimi/live"
import { and, desc, eq } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"

/** Najimi's last answer again: it's taken back and the turn runs anew. */
export async function POST(_: Request, ctx: RouteContext<"/api/rooms/[id]/retry">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown room", 404)
  if (chat.status === "generating") return fail("Najimi is still answering", 409)
  const [last] = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.chatId, chat.id))
    .orderBy(desc(schema.messages.createdAt))
    .limit(1)
  if (last?.role === "assistant") {
    await db
      .delete(schema.messages)
      .where(and(eq(schema.messages.id, last.id), eq(schema.messages.chatId, chat.id)))
    await publish(topic.room(chat.id), "removed", { id: last.id })
  }
  await enqueue("agentTurn", { chatId: chat.id }, chat.id)
  return json({ ok: true })
}
