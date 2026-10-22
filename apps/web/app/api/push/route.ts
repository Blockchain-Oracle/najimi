import { db, schema } from "@najimi/db"
import { env } from "@najimi/env/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"

const DEFAULTS = { messages: true, games: true, plans: true, feeds: true }

/** The key a browser subscribes with, and which news this person wants pushed. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const [prefs] = await db
    .select({ push: schema.userPrefs.push })
    .from(schema.userPrefs)
    .where(eq(schema.userPrefs.userId, auth.session.user.id))
  return json({ publicKey: env.VAPID_PUBLIC_KEY ?? null, prefs: prefs?.push ?? DEFAULTS })
}

/** The push services browsers really use; anything else is refused (we post to the endpoint). */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
]
const realPush = (url: string) => {
  try {
    const u = new URL(url)
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(u.hostname))
  } catch {
    return false
  }
}

const subscription = z.object({
  endpoint: z.url().max(1000).refine(realPush, "Not a push service"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
})

/** This browser (or installed app) takes push for them from now on. */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!env.VAPID_PUBLIC_KEY) return fail("Push isn't switched on yet", 503)
  const parsed = await body(request, subscription)
  if ("error" in parsed) return parsed.error
  const { endpoint, keys } = parsed.data
  const values = {
    userId: auth.session.user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
  }
  await db
    .insert(schema.pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: values })
  return json({ ok: true })
}

const unsubscribe = z.object({ endpoint: z.url().max(1000) })

/** This browser stops taking push. */
export async function DELETE(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, unsubscribe)
  if ("error" in parsed) return parsed.error
  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.endpoint, parsed.data.endpoint),
        eq(schema.pushSubscriptions.userId, auth.session.user.id),
      ),
    )
  return json({ ok: true })
}

const prefs = z.object({
  messages: z.boolean(),
  games: z.boolean(),
  plans: z.boolean(),
  feeds: z.boolean(),
})

/** Which news reaches the phone. */
export async function PATCH(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, prefs)
  if ("error" in parsed) return parsed.error
  await db
    .insert(schema.userPrefs)
    .values({ userId: auth.session.user.id, push: parsed.data })
    .onConflictDoUpdate({ target: schema.userPrefs.userId, set: { push: parsed.data } })
  return json({ prefs: parsed.data })
}
