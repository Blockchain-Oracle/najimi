import { vote } from "@najimi/agent/server"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"

const input = z.object({ optionId: z.string().regex(/^o[1-4]$/) })

/** A vote, or a changed one: one per person; the room sees the tally move at once. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; pollId: string }> },
) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id, pollId } = await ctx.params
  const chat = await ownedChat(auth.session.user.id, id)
  if (!chat) return fail("Unknown room", 404)
  if (!/^[0-9a-f-]{36}$/.test(pollId)) return fail("Unknown poll", 404)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const ok = await vote(chat.id, pollId, auth.session.user.id, parsed.data.optionId)
  return ok ? json({ ok: true }) : fail("That poll is closed", 409)
}
