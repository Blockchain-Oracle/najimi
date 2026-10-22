import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"
import { selfOf } from "@/lib/people"
import { matchOf, profileByUsername } from "@/lib/social"

/** How well your taste matches theirs (Qloo compare), and what you share. */
export async function GET(_: Request, ctx: RouteContext<"/api/u/[username]/match">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  const profile = await profileByUsername((await ctx.params).username, me)
  if (!profile || profile.hidden || profile.isSelf) return fail("Unknown person", 404)
  const self = await selfOf(me)
  if (!self) return fail("Pick a few loves first", 409)
  const mine = await db.select().from(schema.loves).where(eq(schema.loves.personId, self.id))
  const match = await matchOf({ userId: me, loves: mine }, { loves: profile.loves })
  return json({ match })
}
