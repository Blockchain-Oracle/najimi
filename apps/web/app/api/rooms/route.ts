import { publishMessage, toUI } from "@najimi/agent/server"
import { DEFAULT_LOCALE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { createCircle } from "@/lib/chat/store"
import { selfOf } from "@/lib/people"
import { friendsOf, notify } from "@/lib/social"

const input = z.object({
  name: z.string().trim().min(1).max(60),
  memberIds: z.array(z.string().min(1).max(64)).max(30).default([]),
})

/**
 * A new circle with friends in it (only friends can be added; anyone else joins by the link).
 * Everyone added hears about it, and Najimi says hello in the room.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const me = auth.session.user.id
  const self = await selfOf(me)
  if (!self) return fail("Pick a few loves first", 409)
  const friends = new Set((await friendsOf(me)).map((f) => f.userId))
  const memberIds = parsed.data.memberIds.filter((id) => friends.has(id))
  const chat = await createCircle({
    ownerId: me,
    name: parsed.data.name,
    memberIds,
    locale: DEFAULT_LOCALE,
  })
  const [hello] = await db
    .insert(schema.messages)
    .values({
      id: `sys_${chat.id}`,
      chatId: chat.id,
      role: "system",
      parts: [{ type: "text", text: `${self.name} started ${parsed.data.name}` }],
    })
    .returning()
  if (hello) await publishMessage(chat.id, toUI(hello))
  for (const id of memberIds)
    await notify({
      userId: id,
      kind: "invite",
      actorId: me,
      chatId: chat.id,
      data: { name: chat.name },
    })
  return json({ chatId: chat.id }, 201)
}
