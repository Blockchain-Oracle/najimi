import { db, schema } from "@najimi/db"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"

/** Built on Qloo: every Qloo call a run made, in order (the request, never the response body). */
export async function GET(_: Request, ctx: RouteContext<"/api/runs/[runId]/qloo-calls">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const runId = z.uuid().safeParse((await ctx.params).runId).data
  if (!runId) return fail("Unknown run", 404)
  const calls = await db
    .select({
      id: schema.qlooCalls.id,
      purpose: schema.qlooCalls.purpose,
      path: schema.qlooCalls.path,
      params: schema.qlooCalls.params,
      status: schema.qlooCalls.status,
      ms: schema.qlooCalls.ms,
      cacheHit: schema.qlooCalls.cacheHit,
      resultCount: schema.qlooCalls.resultCount,
      createdAt: schema.qlooCalls.createdAt,
    })
    .from(schema.qlooCalls)
    .where(
      and(eq(schema.qlooCalls.runId, runId), eq(schema.qlooCalls.userId, auth.session.user.id)),
    )
    .orderBy(asc(schema.qlooCalls.createdAt))
  return json({ calls })
}
