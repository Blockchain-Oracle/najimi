import { db, schema } from "@najimi/db"
import { env } from "@najimi/env/server"
import { enqueue } from "@najimi/jobs"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"

/**
 * Starts a run that only proves the live pipe works end to end (web → queue → worker → Postgres
 * NOTIFY → SSE → page). Open in development; in production only with the system check token.
 */
export async function POST(request: Request) {
  const allowed =
    env.NODE_ENV !== "production" ||
    (env.SYSTEM_CHECK_TOKEN && request.headers.get("x-check-token") === env.SYSTEM_CHECK_TOKEN)
  if (!allowed) return NextResponse.json({ error: "Not available" }, { status: 404 })
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  const [run] = await db
    .insert(schema.runs)
    .values({ ownerId: session.user.id, kind: "live-check" })
    .returning({ id: schema.runs.id })
  if (!run) return NextResponse.json({ error: "Couldn't start" }, { status: 500 })
  await enqueue("liveCheck", { runId: run.id })
  return NextResponse.json({ runId: run.id })
}
