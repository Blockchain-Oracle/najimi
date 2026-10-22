import "server-only"
import { db, schema } from "@najimi/db"
import { TITLES } from "@najimi/games/round"
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm"
import { inviteToken } from "@/lib/chat/store"

/*
 * Every public link someone has made, in one list (Settings → Your share links), and one way to
 * stop each: taste cards, chats and Wrapped are share rows; plans and game rounds close (then only
 * their owner and the chat's members open them); a business plan's link is dropped; a circle's
 * invite gets a new token (the old one stops working).
 */

export type LinkKind =
  | "person"
  | "chat"
  | "creation"
  | "wrapped"
  | "plan"
  | "game"
  | "business"
  | "invite"

export type LinkRow = { kind: LinkKind; id: string; title: string; path: string; createdAt: Date }

const RECENT = 30

export async function linksOf(userId: string): Promise<LinkRow[]> {
  const [shares, plans, games, businesses, circles] = await Promise.all([
    db
      .select()
      .from(schema.shares)
      .where(and(eq(schema.shares.ownerId, userId), isNull(schema.shares.revokedAt)))
      .orderBy(desc(schema.shares.createdAt)),
    db
      .select()
      .from(schema.plans)
      .where(and(eq(schema.plans.ownerId, userId), isNull(schema.plans.closedAt)))
      .orderBy(desc(schema.plans.createdAt))
      .limit(RECENT),
    db
      .select()
      .from(schema.gameRounds)
      .where(
        and(
          eq(schema.gameRounds.createdBy, userId),
          eq(schema.gameRounds.daily, false),
          isNull(schema.gameRounds.closedAt),
        ),
      )
      .orderBy(desc(schema.gameRounds.createdAt))
      .limit(RECENT),
    db
      .select()
      .from(schema.businesses)
      .where(and(eq(schema.businesses.ownerId, userId), isNotNull(schema.businesses.shareToken))),
    db
      .select()
      .from(schema.chats)
      .where(
        and(
          eq(schema.chats.ownerId, userId),
          eq(schema.chats.kind, "circle"),
          isNotNull(schema.chats.inviteToken),
        ),
      ),
  ])
  // A share row is named by what it shows: the chat's title, the person's name, the creation's.
  const refs = shares.map((s) => s.refId)
  const [chatTitles, people, creations] = refs.length
    ? await Promise.all([
        db
          .select({ id: schema.chats.id, label: schema.chats.title })
          .from(schema.chats)
          .where(inArray(schema.chats.id, refs)),
        db
          .select({ id: schema.people.id, label: schema.people.name })
          .from(schema.people)
          .where(inArray(schema.people.id, refs)),
        db
          .select({ id: schema.creations.id, label: schema.creations.title })
          .from(schema.creations)
          .where(inArray(schema.creations.id, refs)),
      ])
    : [[], [], []]
  const labels = new Map([...chatTitles, ...people, ...creations].map((r) => [r.id, r.label]))
  const rows: LinkRow[] = [
    ...shares.map((s) => ({
      kind: s.kind,
      id: s.token,
      title: labels.get(s.refId) ?? "",
      path: s.kind === "wrapped" ? `/wrapped/${s.token}` : `/s/${s.token}`,
      createdAt: s.createdAt,
    })),
    ...plans.map((p) => ({
      kind: "plan" as const,
      id: p.id,
      title: p.title,
      path: `/plan/${p.token}`,
      createdAt: p.createdAt,
    })),
    ...games.map((g) => ({
      kind: "game" as const,
      id: g.id,
      title: TITLES[g.kind],
      path: `/play/${g.token}`,
      createdAt: g.createdAt,
    })),
    ...businesses.map((b) => ({
      kind: "business" as const,
      id: b.id,
      title: b.name,
      path: `/b/${b.shareToken}`,
      createdAt: b.createdAt,
    })),
    ...circles.map((c) => ({
      kind: "invite" as const,
      id: c.id,
      title: c.name ?? "",
      path: `/join/${c.inviteToken}`,
      createdAt: c.createdAt,
    })),
  ]
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/** Stops one link (only the owner's own). */
export async function stopLink(userId: string, kind: LinkKind, id: string) {
  const now = new Date()
  if (kind === "plan")
    await db
      .update(schema.plans)
      .set({ closedAt: now })
      .where(and(eq(schema.plans.id, id), eq(schema.plans.ownerId, userId)))
  else if (kind === "game")
    await db
      .update(schema.gameRounds)
      .set({ closedAt: now })
      .where(and(eq(schema.gameRounds.id, id), eq(schema.gameRounds.createdBy, userId)))
  else if (kind === "business")
    await db
      .update(schema.businesses)
      .set({ shareToken: null })
      .where(and(eq(schema.businesses.id, id), eq(schema.businesses.ownerId, userId)))
  else if (kind === "invite")
    await db
      .update(schema.chats)
      .set({ inviteToken: inviteToken() })
      .where(and(eq(schema.chats.id, id), eq(schema.chats.ownerId, userId)))
  else
    await db
      .update(schema.shares)
      .set({ revokedAt: now })
      .where(and(eq(schema.shares.token, id), eq(schema.shares.ownerId, userId)))
}
