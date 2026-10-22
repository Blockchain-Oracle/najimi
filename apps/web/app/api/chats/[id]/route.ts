import { AGENT } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"
import { ownedPerson } from "@/lib/people"

const patch = z.object({
  title: z.string().trim().min(1).max(AGENT.titleMax).optional(),
  personId: z.uuid().optional(),
  mode: z.enum(["ask", "auto", "plan"]).optional(),
})

/** Rename, switch who it's for, or change the mode (Ask before making / Make automatically / Plan only). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/chats/[id]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown chat", 404)
  const parsed = await body(request, patch)
  if ("error" in parsed) return parsed.error
  const { title, personId, mode } = parsed.data
  if (personId && !(await ownedPerson(auth.session.user.id, personId)))
    return fail("Unknown person", 404)
  await db
    .update(schema.chats)
    .set({
      ...(title ? { title } : {}),
      ...(personId ? { personId } : {}),
      ...(mode ? { mode } : {}),
    })
    .where(eq(schema.chats.id, chat.id))
  if (mode)
    await db
      .insert(schema.userPrefs)
      .values({ userId: auth.session.user.id, mode })
      .onConflictDoUpdate({ target: schema.userPrefs.userId, set: { mode } })
  return json({ ok: true })
}

export async function DELETE(_: Request, ctx: RouteContext<"/api/chats/[id]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown chat", 404)
  // Only who started a room can delete it; anyone else leaves it.
  if (chat.ownerId === auth.session.user.id)
    await db.delete(schema.chats).where(eq(schema.chats.id, chat.id))
  else
    await db
      .delete(schema.chatMembers)
      .where(
        and(
          eq(schema.chatMembers.chatId, chat.id),
          eq(schema.chatMembers.userId, auth.session.user.id),
        ),
      )
  return json({ ok: true })
}
