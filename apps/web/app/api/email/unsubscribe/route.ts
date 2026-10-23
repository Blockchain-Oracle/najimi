import { db, schema } from "@najimi/db"
import { type EmailKind, readUnsubscribe } from "@najimi/email"
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
  const url = new URL(request.url)
  const kind = await turnOff(url.searchParams.get("t"))
  return NextResponse.redirect(new URL(`/unsubscribed${kind ? `?k=${kind}` : ""}`, url))
}

/** The mail app's one-click unsubscribe (List-Unsubscribe-Post). */
export async function POST(request: Request) {
  const kind = await turnOff(new URL(request.url).searchParams.get("t"))
  return kind ? new Response("ok") : new Response("Unknown link", { status: 400 })
}
