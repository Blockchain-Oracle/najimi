import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { CHARS, namedThings, POSTS } from "@/lib/named-things"
import { allow } from "@/lib/rate-limit"

const input = z.object({
  platform: z.enum(["X", "Instagram"]),
  texts: z.array(z.string().max(CHARS)).max(POSTS),
})

/** The artists, films, places and brands named in a set of posts, as candidates for Qloo. */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!allow(`named:${auth.session.user.id}`, 10, 60 * 60_000))
    return fail("That's enough reading for this hour", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const candidates = await namedThings({ userId: auth.session.user.id, ...parsed.data })
  return json({ candidates })
}
