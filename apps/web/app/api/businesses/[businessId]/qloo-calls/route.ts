import { db, schema } from "@najimi/db"
import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"
import { ownedBusiness } from "@/lib/access"
import { getSession } from "@/lib/session"

const LIMIT = 200

/** The Built-on-Qloo log for one business: every call its work made, newest first (plan §7). */
export async function GET(
  _: Request,
  ctx: RouteContext<"/api/businesses/[businessId]/qloo-calls">,
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  const businessId = z.uuid().safeParse((await ctx.params).businessId).data
  if (!businessId || !(await ownedBusiness(session.user.id, businessId)))
    return NextResponse.json({ error: "Unknown business" }, { status: 404 })
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
      error: schema.qlooCalls.error,
      createdAt: schema.qlooCalls.createdAt,
    })
    .from(schema.qlooCalls)
    .where(eq(schema.qlooCalls.businessId, businessId))
    .orderBy(desc(schema.qlooCalls.createdAt))
    .limit(LIMIT)
  return NextResponse.json({ calls })
}
