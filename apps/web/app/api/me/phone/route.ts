import { db, schema } from "@najimi/db"
import { env } from "@najimi/env/server"
import { and, eq, isNotNull, ne } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"

/*
 * Your phone number, so Najimi knows you when you add it to a call: saved here, confirmed by
 * calling Najimi's number once from it (see the inbound webhook). Members only.
 */

/** Najimi's own number, when its phone agent is set up. */
const najimiNumber = () =>
  env.ELEVENLABS_TOOL_SECRET && env.ELEVENLABS_PHONE_NUMBER_ID
    ? (env.TWILIO_PHONE_NUMBER ?? null)
    : null

export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const [prefs] = await db
    .select({ phone: schema.userPrefs.phone, confirmedAt: schema.userPrefs.phoneConfirmedAt })
    .from(schema.userPrefs)
    .where(eq(schema.userPrefs.userId, auth.session.user.id))
  return json({
    phone: prefs?.phone ?? null,
    confirmed: Boolean(prefs?.confirmedAt),
    najimi: najimiNumber(),
  })
}

const input = z.object({
  phone: z
    .string()
    .transform((p) => p.replace(/[\s().-]/g, ""))
    .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Start with your country code, like +234")),
})

export async function PUT(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user as typeof auth.session.user & { isAnonymous?: boolean | null }
  if (me.isAnonymous) return fail("Sign in first to add your number", 403)
  if (!najimiNumber()) return fail("Phone calls aren't switched on yet", 503)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const { phone } = parsed.data
  const [taken] = await db
    .select({ userId: schema.userPrefs.userId })
    .from(schema.userPrefs)
    .where(
      and(
        eq(schema.userPrefs.phone, phone),
        isNotNull(schema.userPrefs.phoneConfirmedAt),
        ne(schema.userPrefs.userId, me.id),
      ),
    )
  if (taken) return fail("That number is already confirmed on another account", 409)
  const [prefs] = await db
    .select({ phone: schema.userPrefs.phone, confirmedAt: schema.userPrefs.phoneConfirmedAt })
    .from(schema.userPrefs)
    .where(eq(schema.userPrefs.userId, me.id))
  // The same number stays confirmed; a new one waits for its first call.
  const confirmedAt = prefs?.phone === phone ? (prefs.confirmedAt ?? null) : null
  await db
    .insert(schema.userPrefs)
    .values({ userId: me.id, phone, phoneConfirmedAt: confirmedAt })
    .onConflictDoUpdate({
      target: schema.userPrefs.userId,
      set: { phone, phoneConfirmedAt: confirmedAt },
    })
  return json({ phone, confirmed: Boolean(confirmedAt), najimi: najimiNumber() })
}

export async function DELETE() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  await db
    .update(schema.userPrefs)
    .set({ phone: null, phoneConfirmedAt: null })
    .where(eq(schema.userPrefs.userId, auth.session.user.id))
  return json({ phone: null, confirmed: false, najimi: najimiNumber() })
}
