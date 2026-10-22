import { rebuildBusiness } from "@najimi/agent/server"
import { fail, json, withSession } from "@/lib/api"
import { businessOf } from "@/lib/business"
import { allow } from "@/lib/rate-limit"

/** Builds the plan again from today's Qloo. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const b = await businessOf((await params).id, auth.session.user.id)
  if (!b) return fail("No such business", 404)
  if (b.status === "building") return fail("It's already building", 409)
  if (!allow(`business-rebuild:${b.id}`, 3, 60 * 60_000))
    return fail("That's enough rebuilds for this hour", 429)
  return json({ runId: await rebuildBusiness(b) })
}
