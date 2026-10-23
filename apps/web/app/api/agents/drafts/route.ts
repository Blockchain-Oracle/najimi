import { draftPost } from "@najimi/agent/server"
import { connectionOf } from "@najimi/connectors/sessions"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

const input = z.object({ platform: z.enum(["x", "instagram"]) })

/** The Post agent writes one now (it does so by itself on Sunday evenings); it waits for a yes. */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  if (!allow(`post-draft:${me}`, 4, 86_400_000)) return fail("That's enough drafts for today", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  if (!(await connectionOf(me, parsed.data.platform)))
    return fail("Connect that account first", 409)
  const draft = await draftPost(me, parsed.data.platform)
  if (!draft) return fail("Add a few loves first, so there's something to post about", 409)
  return json({ draft: { id: draft.id, text: draft.text } })
}
