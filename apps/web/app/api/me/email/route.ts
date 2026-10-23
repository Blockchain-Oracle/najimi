import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { body, json, withSession } from "@/lib/api"

/** Which emails you get beyond sign-in codes: the weekly digest, and booking and plan news. */
const input = z.object({ weekly: z.boolean().optional(), news: z.boolean().optional() })

async function prefsOf(userId: string) {
  const [row] = await db
    .select({ prefs: schema.userPrefs.emailPrefs })
    .from(schema.userPrefs)
    .where(eq(schema.userPrefs.userId, userId))
  return row?.prefs ?? { weekly: true, news: true }
}

export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const email = auth.session.user.email
  return json({
    email: email.endsWith(".invalid") ? null : email,
    prefs: await prefsOf(auth.session.user.id),
  })
}

export async function PATCH(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const me = auth.session.user.id
  const next = { ...(await prefsOf(me)), ...parsed.data }
  await db
    .insert(schema.userPrefs)
    .values({ userId: me, emailPrefs: next })
    .onConflictDoUpdate({ target: schema.userPrefs.userId, set: { emailPrefs: next } })
  return json({ prefs: next })
}
