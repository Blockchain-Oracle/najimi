import { readToolToken } from "@najimi/booking/calls"
import { db, schema } from "@najimi/db"
import { and, eq, sql } from "drizzle-orm"

/*
 * A table call in progress says what's happening ("they're checking the book"): kept on the
 * booking while it's still calling, so the call card shows it under the venue's name.
 */
export async function POST(request: Request) {
  const token = readToolToken("booking", request.headers.get("x-najimi-token"))
  if (!token) return Response.json({ error: "Not allowed" }, { status: 401 })
  const { text } = (await request.json().catch(() => ({}))) as { text?: string }
  const line = text?.trim().slice(0, 120)
  if (!line) return Response.json({ ok: false })
  await db
    .update(schema.bookings)
    .set({
      data: sql`${schema.bookings.data} || ${JSON.stringify({ live: line, liveAt: new Date().toISOString() })}::jsonb`,
    })
    .where(and(eq(schema.bookings.id, token.bookingId), eq(schema.bookings.status, "calling")))
  return Response.json({ ok: true })
}
