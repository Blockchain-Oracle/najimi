import { startPoll } from "@najimi/agent/server"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"
import { allow } from "@/lib/rate-limit"

const input = z.object({
  question: z.string().trim().min(3).max(140),
  options: z
    .array(z.object({ label: z.string().trim().min(1).max(60) }))
    .min(2)
    .max(4),
})

/** Someone in a circle or DM puts a question to the room; the card lands for everyone. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const userId = auth.session.user.id
  const chat = await ownedChat(userId, (await ctx.params).id)
  if (!chat) return fail("Unknown room", 404)
  if (chat.kind === "agent") return fail("Polls are for circles and chats with friends", 400)
  if (!allow(`poll:${userId}`, 10, 60_000)) return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const poll = await startPoll({ chatId: chat.id, userId, ...parsed.data })
  return json({ pollId: poll.pollId }, 201)
}
