import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"
import { ownedBusiness } from "@/lib/access"
import { getSession } from "@/lib/session"

/**
 * One evidence chip (plan R1): which Qloo endpoint, which signal, what came back. The answer's
 * body stays on the server; the chip shows the request and what the product took from it.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/qloo-calls/[callId]">) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  const callId = z.uuid().safeParse((await ctx.params).callId).data
  if (!callId) return NextResponse.json({ error: "Unknown call" }, { status: 404 })
  const [call] = await db.select().from(schema.qlooCalls).where(eq(schema.qlooCalls.id, callId))
  if (!call?.businessId || !(await ownedBusiness(session.user.id, call.businessId)))
    return NextResponse.json({ error: "Unknown call" }, { status: 404 })
  const { cacheKey: _key, ...rest } = call
  return NextResponse.json({ call: rest })
}
