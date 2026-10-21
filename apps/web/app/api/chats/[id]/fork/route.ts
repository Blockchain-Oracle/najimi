import { db, schema } from "@najimi/db"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { messagesOf, ownedChat } from "@/lib/chat/store"

/** A new chat that starts with this one's messages up to and including `messageId`. */
export async function POST(request: Request, ctx: RouteContext<"/api/chats/[id]/fork">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown chat", 404)
  const parsed = await body(request, z.object({ messageId: z.string().max(100) }))
  if ("error" in parsed) return parsed.error
  const messages = messagesOf(chat)
  const at = messages.findIndex((m) => m.id === parsed.data.messageId)
  if (at === -1) return fail("Unknown message", 404)
  const [fork] = await db
    .insert(schema.chats)
    .values({
      ownerId: chat.ownerId,
      personId: chat.personId,
      locale: chat.locale,
      mode: chat.mode,
      title: chat.title ? `${chat.title} ↳` : null,
      messages: messages.slice(0, at + 1),
      forkedFromChatId: chat.id,
      forkedAtMessageId: parsed.data.messageId,
    })
    .returning({ id: schema.chats.id })
  return json({ chatId: fork?.id })
}
