import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"
import { localeFrom } from "@/lib/request-locale"
import { answerStory } from "@/lib/stories"

const input = z.object({ text: z.string().trim().min(1).max(1000) })

/** A reply to someone's story, as a DM that quotes it. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Not found", 404)
  if (!allow(`story-reply:${auth.session.user.id}`, 20, 60_000))
    return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const sent = await answerStory(id, auth.session.user.id, parsed.data.text, localeFrom(request))
  return sent ? json(sent) : fail("Not found", 404)
}
