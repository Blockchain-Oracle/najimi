import { createHmac, timingSafeEqual } from "node:crypto"
import { applyCallResult, callNotAnswered } from "@najimi/agent/server"
import { resultOf } from "@najimi/booking/calls"
import { db, schema } from "@najimi/db"
import { env } from "@najimi/env/server"
import { eq, sql } from "drizzle-orm"

/*
 * ElevenLabs' post-call webhook: a table call ended (or never connected). Signed with HMAC over
 * the raw body (`ElevenLabs-Signature: t=<unix>,v0=<hex>`); anything unsigned, stale or unknown is
 * refused. The booking it belongs to rides on the call as a variable.
 */

const MAX_AGE_S = 30 * 60

function verified(raw: string, header: string | null) {
  if (!env.ELEVENLABS_WEBHOOK_SECRET || !header) return false
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]))
  const t = Number(parts.t)
  if (!parts.v0 || !Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > MAX_AGE_S) return false
  const expected = createHmac("sha256", env.ELEVENLABS_WEBHOOK_SECRET)
    .update(`${t}.${raw}`)
    .digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(parts.v0)
  return a.length === b.length && timingSafeEqual(a, b)
}

type Event = {
  type: "post_call_transcription" | "post_call_audio" | "call_initiation_failure"
  data: {
    conversation_id?: string
    failure_reason?: string
    conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> }
  } & Parameters<typeof resultOf>[0]
}

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verified(raw, request.headers.get("elevenlabs-signature")))
    return new Response("Unauthorised", { status: 401 })
  const event = JSON.parse(raw) as Event
  const bookingId = event.data.conversation_initiation_client_data?.dynamic_variables?.booking_id
  const conversationId = event.data.conversation_id
  // By the variable the call carried, or (a call that never connected) by its conversation.
  const [booking] =
    typeof bookingId === "string" && /^[0-9a-f-]{36}$/.test(bookingId)
      ? await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId))
      : conversationId
        ? await db
            .select()
            .from(schema.bookings)
            .where(sql`${schema.bookings.ref}->>'conversationId' = ${conversationId}`)
        : []
  if (!booking) return new Response("ok")
  if (event.type === "post_call_transcription")
    await applyCallResult(booking, resultOf({ ...event.data, status: "done" }))
  else if (event.type === "call_initiation_failure")
    await callNotAnswered(booking, event.data.failure_reason ?? "no-answer")
  return new Response("ok")
}
