import { callAudio } from "@najimi/booking/calls"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { fail, withSession } from "@/lib/api"
import { isMember } from "@/lib/chat/store"

/*
 * A table call's recording, for the booking's owner or the people in the chat it was made in
 * (the call said up front that it was recorded). Streamed from ElevenLabs, which keeps it.
 */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const id = (await ctx.params).id
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Unknown booking", 404)
  const [b] = await db
    .select({
      ownerId: schema.bookings.ownerId,
      chatId: schema.bookings.chatId,
      ref: schema.bookings.ref,
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, id))
  const me = auth.session.user.id
  if (!b || (b.ownerId !== me && !(b.chatId && (await isMember(b.chatId, me)))))
    return fail("Unknown booking", 404)
  const conversationId = (b.ref as Record<string, string>).conversationId
  const audio = conversationId ? await callAudio(conversationId) : null
  if (!audio?.body) return fail("No recording for this call", 404)
  return new Response(audio.body, {
    headers: {
      "content-type": audio.headers.get("content-type") ?? "audio/mpeg",
      "cache-control": "private, max-age=3600",
    },
  })
}
