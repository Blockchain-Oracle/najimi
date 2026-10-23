import { pollTally } from "@najimi/agent/server"
import { fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"

/** A poll's tally for its card: votes per choice, who voted, and your own vote. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string; pollId: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id, pollId } = await ctx.params
  const chat = await ownedChat(auth.session.user.id, id)
  if (!chat) return fail("Unknown room", 404)
  if (!/^[0-9a-f-]{36}$/.test(pollId)) return fail("Unknown poll", 404)
  const tally = await pollTally(pollId, auth.session.user.id)
  return tally ? json(tally) : fail("Unknown poll", 404)
}
