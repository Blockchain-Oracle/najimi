import { STORIES } from "@najimi/config"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { localeFrom } from "@/lib/request-locale"
import { answerStory, markViewed } from "@/lib/stories"

const input = z.object({ reaction: z.enum(STORIES.reactions).optional() })

/** They saw it; a reaction is kept with the view and sent to its owner as a DM. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Not found", 404)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const userId = auth.session.user.id
  const story = await markViewed(id, userId, parsed.data.reaction)
  if (!story) return fail("Not found", 404)
  if (parsed.data.reaction && story.ownerId !== userId)
    await answerStory(id, userId, parsed.data.reaction, localeFrom(request))
  return json({ ok: true })
}
