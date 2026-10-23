import { db, schema } from "@najimi/db"
import { type EmailKind, readUnsubscribe } from "@najimi/email"
import { env } from "@najimi/env/server"
import { eq, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

/*
 * One link (or one click from the mail app, RFC 8058) turns that kind of email off for the person
 * the signed link belongs to; nothing else is needed, not even being signed in.
 */

async function turnOff(token: string | null): Promise<EmailKind | null> {
  const found = readUnsubscribe(token)
  if (!found) return null
  await db
    .update(schema.userPrefs)
    .set({
      emailPrefs: sql`${schema.userPrefs.emailPrefs} || ${JSON.stringify({ [found.kind]: false })}::jsonb`,
    })
    .where(eq(schema.userPrefs.userId, found.userId))
  return found.kind
}

export async function GET(request: Request) {
  const kind = await turnOff(new URL(request.url).searchParams.get("t"))
  // The public address: behind the proxy, the request's own URL is the container's.
  return NextResponse.redirect(
    new URL(`/unsubscribed${kind ? `?k=${kind}` : ""}`, env.BETTER_AUTH_URL),
  )
}

/** The mail app's one-click unsubscribe (List-Unsubscribe-Post). */
export async function POST(request: Request) {
  const kind = await turnOff(new URL(request.url).searchParams.get("t"))
  return kind ? new Response("ok") : new Response("Unknown link", { status: 400 })
}
