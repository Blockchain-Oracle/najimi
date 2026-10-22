import { allMessages } from "@najimi/agent/server"
import "server-only"
import type { NajimiUIMessage } from "@najimi/agent"
import { db, schema } from "@najimi/db"
import { and, eq, isNull } from "drizzle-orm"
import { cache } from "react"

export type ShareRow = typeof schema.shares.$inferSelect

/** A live share link (revoked ones are gone at once). One lookup per request. */
export const liveShare = cache(async (token: string): Promise<ShareRow | null> => {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null
  const [share] = await db
    .select()
    .from(schema.shares)
    .where(and(eq(schema.shares.token, token), isNull(schema.shares.revokedAt)))
  return share ?? null
})

/** The words a shared thing is known by, for its page title and link preview. */
export const sharedSubject = cache(async (share: ShareRow) => {
  if (share.kind === "creation") {
    const [c] = await db.select().from(schema.creations).where(eq(schema.creations.id, share.refId))
    if (c?.status !== "ready") return null
    const [chat] = c.chatId
      ? await db
          .select({ locale: schema.chats.locale })
          .from(schema.chats)
          .where(eq(schema.chats.id, c.chatId))
      : []
    return { kind: "creation" as const, creation: c, locale: chat?.locale ?? null }
  }
  if (share.kind === "chat") {
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, share.refId))
    if (!chat) return null
    const made = await db
      .select()
      .from(schema.creations)
      .where(and(eq(schema.creations.chatId, chat.id), eq(schema.creations.status, "ready")))
    return {
      kind: "chat" as const,
      locale: chat.locale,
      chat,
      messages: (await allMessages(chat.id)) as NajimiUIMessage[],
      made,
    }
  }
  const [person] = await db.select().from(schema.people).where(eq(schema.people.id, share.refId))
  if (!person) return null
  const [[taste], loves] = await Promise.all([
    db.select().from(schema.tastes).where(eq(schema.tastes.personId, person.id)),
    db.select().from(schema.loves).where(eq(schema.loves.personId, person.id)),
  ])
  return { kind: "person" as const, locale: person.locale, person, taste: taste ?? null, loves }
})
