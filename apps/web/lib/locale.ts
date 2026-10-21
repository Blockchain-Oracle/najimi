"use server"

import { db, schema } from "@najimi/db"
import { cookies } from "next/headers"
import { LOCALE_COOKIE } from "@/i18n/routing"
import { isLocale } from "@/lib/i18n"
import { getSession } from "@/lib/session"

/** Switches the language: the cookie for every page, and the person's settings when signed in. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return
  const jar = await cookies()
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
  const session = await getSession()
  if (!session) return
  await db
    .insert(schema.userPrefs)
    .values({ userId: session.user.id, locale })
    .onConflictDoUpdate({ target: schema.userPrefs.userId, set: { locale } })
}
