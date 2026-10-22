import { FEED } from "@najimi/config"
import { fail, json, withSession } from "@/lib/api"
import { feedPage } from "@/lib/feed"
import { selfOf } from "@/lib/people"
import { allow } from "@/lib/rate-limit"

/** The next page of your feed: `?cursor=` from the last page, or where you got to last time. */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!allow(`feed:${auth.session.user.id}`, FEED.perMinute, 60_000))
    return fail("Slow down a little", 429)
  const self = await selfOf(auth.session.user.id)
  if (!self) return json({ state: "empty", cards: [], next: null })
  const cursor = new URL(request.url).searchParams.get("cursor")
  return json(await feedPage(self, cursor))
}
