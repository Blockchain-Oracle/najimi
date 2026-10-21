import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"

/**
 * One because chip: which Qloo endpoint, which signal, what came back. Only the user the call was
 * made for may open it; the answer's body stays on the server.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/qloo-calls/[callId]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const callId = z.uuid().safeParse((await ctx.params).callId).data
  if (!callId) return fail("Unknown call", 404)
  const [call] = await db
    .select()
    .from(schema.qlooCalls)
    .where(and(eq(schema.qlooCalls.id, callId), eq(schema.qlooCalls.userId, auth.session.user.id)))
  if (!call) return fail("Unknown call", 404)
  const { cacheKey: _key, userId: _user, ...rest } = call
  return json({ call: rest })
}
