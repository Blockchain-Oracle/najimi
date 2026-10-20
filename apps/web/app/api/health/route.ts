import { db } from "@najimi/db"
import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"

/** Readiness for the platform's health check: the app answers and its database does. */
export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "cache-control": "no-store" } },
    )
  }
}
