import "server-only"
import { publishMessage, toUI } from "@najimi/agent/server"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { blockedWith, notify } from "@/lib/social"
import { joinByToken } from "./store"

/**
 * Joins a circle by its invite link: the circle hears it ("Juno joined"), its starter gets the
 * news. Returns the circle id, or null for a link that's no longer valid.
 */
export async function joinCircle(token: string, userId: string, name: string) {
  // Someone the circle's starter blocked (or who blocked them) can't come in by link.
  const [circle] = await db
    .select({ ownerId: schema.chats.ownerId })
    .from(schema.chats)
    .where(eq(schema.chats.inviteToken, token))
  if (circle && (await blockedWith(userId)).has(circle.ownerId)) return null
  const result = await joinByToken(token, userId)
  if (!result) return null
  if (result.joined) {
    const [row] = await db
      .insert(schema.messages)
      .values({
        id: `sys_${result.chat.id.slice(0, 8)}_${userId.slice(0, 8)}_${Date.now().toString(36)}`,
        chatId: result.chat.id,
        role: "system",
        parts: [{ type: "text", text: `${name} joined` }],
      })
      .returning()
    if (row) await publishMessage(result.chat.id, toUI(row))
    await notify({
      userId: result.chat.ownerId,
      kind: "joined",
      actorId: userId,
      chatId: result.chat.id,
      data: { name: result.chat.name },
    })
  }
  return result.chat.id
}
