import { db, schema } from "@najimi/db"
import { cookies } from "next/headers"
import { z } from "zod"
import { body, json, withSession } from "@/lib/api"
import { forgetUser } from "@/lib/forget"

const prefs = z.object({ mode: z.enum(["ask", "auto", "plan"]) })

/** The person's settings: how new chats make things (ask first, automatically, or plan only). */
export async function PATCH(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, prefs)
  if ("error" in parsed) return parsed.error
  const { mode } = parsed.data
  await db
    .insert(schema.userPrefs)
    .values({ userId: auth.session.user.id, mode })
    .onConflictDoUpdate({ target: schema.userPrefs.userId, set: { mode } })
  return json({ ok: true })
}

/**
 * Delete all my data (T21): the account and everything in it (people, tastes, chats, photos,
 * creations, workflows, share links), then the session cookie. It can't be undone.
 */
export async function DELETE() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { objects } = await forgetUser(auth.session.user.id)
  const jar = await cookies()
  // A "__Secure-" cookie (production) can only be cleared by a Secure Set-Cookie.
  for (const c of jar.getAll())
    if (c.name.includes("better-auth"))
      jar.set(c.name, "", { path: "/", maxAge: 0, secure: c.name.startsWith("__Secure-") })
  return json({ ok: true, objects })
}
