import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"

/** Asks Najimi to stop answering; the worker sees it within a second and keeps what it said. */
export async function POST(_: Request, ctx: RouteContext<"/api/rooms/[id]/stop">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown room", 404)
  await db
    .update(schema.chats)
    .set({ status: "stopping" })
    .where(and(eq(schema.chats.id, chat.id), eq(schema.chats.status, "generating")))
  return json({ ok: true })
}
