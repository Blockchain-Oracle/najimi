import { randomUUID } from "node:crypto"
import { isInbound, toolToken } from "@najimi/booking/calls"
import { CALLS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm"
import { createAgentRoom } from "@/lib/chat/store"
import { selfOf } from "@/lib/people"

/*
 * Someone dialled Najimi's number (usually to merge it into a call they're on). ElevenLabs asks
 * who it is as the call connects: a confirmed number gets its own Najimi chat for this call and a
 * signed token its questions carry; a number saved but not yet confirmed is confirmed by this very
 * call; anyone else is told to add their number in Settings, and the agent hangs up.
 */

const normal = (phone: string) => phone.replace(/[^\d+]/g, "")

const reply = (vars: Record<string, string>, firstMessage: string) =>
  Response.json({
    type: "conversation_initiation_client_data",
    dynamic_variables: { user_name: "there", known: "no", ask_token: "none", ...vars },
    conversation_config_override: { agent: { first_message: firstMessage } },
  })

export async function POST(request: Request) {
  if (!isInbound(request.headers.get("x-najimi-key")))
    return Response.json({ error: "Not allowed" }, { status: 401 })
  const { caller_id: callerId } = (await request.json().catch(() => ({}))) as { caller_id?: string }
  const phone = callerId ? normal(callerId) : ""
  const stranger = () =>
    reply(
      {},
      "Hi, this is Najimi, an AI. I don't know this number yet: add it in Najimi's settings, then call me again. Bye for now.",
    )
  if (!/^\+\d{8,15}$/.test(phone)) return stranger()

  const [confirmed] = await db
    .select()
    .from(schema.userPrefs)
    .where(and(eq(schema.userPrefs.phone, phone), isNotNull(schema.userPrefs.phoneConfirmedAt)))
  const [pending] = confirmed
    ? [null]
    : await db
        .select()
        .from(schema.userPrefs)
        .where(and(eq(schema.userPrefs.phone, phone), isNull(schema.userPrefs.phoneConfirmedAt)))
        .orderBy(desc(schema.userPrefs.updatedAt))
        .limit(1)
  const prefs = confirmed ?? pending
  if (!prefs) return stranger()
  const self = await selfOf(prefs.userId)
  const name = self?.name?.split(" ")[0] || "there"

  if (!confirmed) {
    // The first call from a saved number confirms it (and frees it from anyone else's settings).
    await db
      .update(schema.userPrefs)
      .set({ phoneConfirmedAt: new Date() })
      .where(eq(schema.userPrefs.userId, prefs.userId))
    await db
      .update(schema.userPrefs)
      .set({ phone: null })
      .where(and(eq(schema.userPrefs.phone, phone), isNull(schema.userPrefs.phoneConfirmedAt)))
    return reply(
      { user_name: name, known: "confirmed" },
      `Hi ${name}, this is Najimi. Your number is confirmed. Next time you're on a call, add me, and say my name when you want me. Bye for now.`,
    )
  }

  if (!self) return stranger()
  // This call's own Najimi chat: what's asked and found on it lands there.
  const chatId = randomUUID()
  await createAgentRoom({
    id: chatId,
    userId: prefs.userId,
    personId: self.id,
    locale: prefs.locale ?? "en",
    mode: prefs.mode,
  })
  await db.update(schema.chats).set({ title: "Phone call" }).where(eq(schema.chats.id, chatId))
  const token = toolToken(
    { kind: "phone", userId: prefs.userId, chatId },
    CALLS.phoneMaxSeconds + 10 * 60,
  )
  return reply(
    { user_name: name, known: "yes", ask_token: token ?? "none" },
    `Hi, I'm Najimi, an AI that ${name} added to this call. I'm listening; say my name when you want me.`,
  )
}
