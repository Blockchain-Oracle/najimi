import "server-only"
import { db, schema } from "@najimi/db"
import type { TasteWords } from "@najimi/db/schema"
import { TITLES } from "@najimi/games/round"
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm"

/*
 * The Taste Passport (W21): a year of culture, stamped as it happened. Every stamp is something
 * real — a love added, a night or trip taken, a stay or table that went ahead, a game played — read
 * from where it already lives, so the Passport can never disagree with what happened.
 */

export type StampKind = "love" | "night" | "trip" | "stay" | "table" | "show" | "game"

export type Stamp = {
  id: string
  kind: StampKind
  title: string
  detail: string | null
  image: string | null
  /** The thing's own kind (urn:entity:artist…) for loves. */
  type: string | null
  at: string
  href: string | null
}

const yearRange = (year: number) => ({
  from: new Date(Date.UTC(year, 0, 1)),
  to: new Date(Date.UTC(year + 1, 0, 1)),
})

export async function selfIdOf(userId: string): Promise<string | null> {
  const [self] = await db
    .select({ id: schema.people.id })
    .from(schema.people)
    .where(and(eq(schema.people.ownerId, userId), eq(schema.people.isSelf, true)))
  return self?.id ?? null
}

/** Every stamp in a year, newest first. */
export async function stampsOf(userId: string, year: number): Promise<Stamp[]> {
  const { from, to } = yearRange(year)
  const now = new Date()
  const until = to < now ? to : now
  const selfId = await selfIdOf(userId)
  const [loves, plans, bookings, games] = await Promise.all([
    selfId
      ? db
          .select()
          .from(schema.loves)
          .where(
            and(
              eq(schema.loves.personId, selfId),
              gte(schema.loves.createdAt, from),
              lt(schema.loves.createdAt, until),
            ),
          )
      : [],
    db
      .select()
      .from(schema.plans)
      .where(
        and(
          eq(schema.plans.ownerId, userId),
          // A night or trip stamps once you said how it was (not "we didn't go").
          inArray(schema.plans.outcome, ["loved", "fine", "not"]),
          isNotNull(schema.plans.startsAt),
          gte(schema.plans.startsAt, from),
          lt(schema.plans.startsAt, until),
        ),
      ),
    db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.ownerId, userId),
          inArray(schema.bookings.status, ["confirmed", "completed"]),
          or(isNull(schema.bookings.outcome), ne(schema.bookings.outcome, "skipped")),
          isNotNull(schema.bookings.startsAt),
          gte(schema.bookings.startsAt, from),
          lt(schema.bookings.startsAt, until),
        ),
      ),
    db
      .select({
        id: schema.gameAnswers.id,
        score: schema.gameAnswers.score,
        at: schema.gameAnswers.createdAt,
        kind: schema.gameRounds.kind,
        token: schema.gameRounds.token,
      })
      .from(schema.gameAnswers)
      .innerJoin(schema.gameRounds, eq(schema.gameRounds.id, schema.gameAnswers.roundId))
      .where(
        and(
          eq(schema.gameAnswers.playerId, userId),
          gte(schema.gameAnswers.createdAt, from),
          lt(schema.gameAnswers.createdAt, until),
        ),
      )
      .orderBy(desc(schema.gameAnswers.createdAt)),
  ])
  const stamps: Stamp[] = [
    ...loves.map((l) => ({
      id: `love:${l.id}`,
      kind: "love" as const,
      title: l.name,
      detail: null,
      image: l.imageUrl,
      type: l.type,
      at: l.createdAt.toISOString(),
      href: null,
    })),
    ...plans.map((p) => ({
      id: `plan:${p.id}`,
      kind: (p.kind === "trip" ? "trip" : "night") as StampKind,
      title: p.title,
      detail: p.city,
      image: p.stops.find((s) => s.image)?.image ?? null,
      type: null,
      at: (p.startsAt ?? p.createdAt).toISOString(),
      href: `/plan/${p.token}`,
    })),
    ...bookings.map((b) => ({
      id: `booking:${b.id}`,
      kind: (b.kind === "hotel" ? "stay" : b.kind === "show" ? "show" : "table") as StampKind,
      title: b.venue ?? b.title,
      detail: b.outcome,
      image: b.image,
      type: null,
      at: (b.startsAt ?? b.createdAt).toISOString(),
      href: null,
    })),
    ...games.map((g) => ({
      id: `game:${g.id}`,
      kind: "game" as const,
      title: TITLES[g.kind],
      detail: String(g.score),
      image: null,
      type: null,
      at: g.at.toISOString(),
      href: g.token ? `/play/${g.token}` : null,
    })),
  ]
  return stamps.sort((a, b) => b.at.localeCompare(a.at))
}

/** How a year's loves were spread over kinds, month by month ("how your taste moved"). */
export function movement(stamps: Stamp[]) {
  const months = Array.from({ length: 12 }, () => new Map<string, number>())
  for (const s of stamps) {
    if (s.kind !== "love" || !s.type) continue
    const m = new Date(s.at).getUTCMonth()
    const kind = s.type.replace("urn:entity:", "")
    months[m]?.set(kind, (months[m]?.get(kind) ?? 0) + 1)
  }
  return months.map((m) => Object.fromEntries(m))
}

/** The story set's slides (cover, loves, words, people, passport). */
export const WRAPPED_SLIDES = 5

/** What's coming: plans and bookings that haven't happened yet (each opens its plan or its chat). */
export type Upcoming = {
  id: string
  kind: "night" | "trip" | "stay" | "table" | "show"
  title: string
  at: string
  image: string | null
  href: string | null
}

export async function upcomingOf(userId: string): Promise<Upcoming[]> {
  const now = Date.now()
  const [plans, bookings] = await Promise.all([
    db
      .select()
      .from(schema.plans)
      .where(
        and(
          eq(schema.plans.ownerId, userId),
          isNull(schema.plans.outcome),
          isNotNull(schema.plans.startsAt),
          gte(schema.plans.startsAt, new Date(now - 12 * 3600_000)),
        ),
      )
      .orderBy(asc(schema.plans.startsAt))
      .limit(6),
    db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.ownerId, userId),
          inArray(schema.bookings.status, ["paid", "confirmed", "calling"]),
          isNotNull(schema.bookings.startsAt),
          gte(schema.bookings.startsAt, new Date(now - 6 * 3600_000)),
        ),
      )
      .orderBy(asc(schema.bookings.startsAt))
      .limit(6),
  ])
  return [
    ...plans.map((p) => ({
      id: `plan:${p.id}`,
      kind: (p.kind === "trip" ? "trip" : "night") as Upcoming["kind"],
      title: p.title,
      at: (p.startsAt as Date).toISOString(),
      image: p.stops.find((s) => s.image)?.image ?? null,
      href: `/plan/${p.token}`,
    })),
    ...bookings.map((b) => ({
      id: `booking:${b.id}`,
      kind: (b.kind === "hotel"
        ? "stay"
        : b.kind === "show"
          ? "show"
          : "table") as Upcoming["kind"],
      title: b.venue ?? b.title,
      at: (b.startsAt as Date).toISOString(),
      image: b.image,
      href: b.chatId ? `/c/${b.chatId}` : null,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at))
}

export type Wrapped = {
  name: string
  username: string | null
  look: string | null
  city: string | null
  year: number
  loves: { name: string; image: string | null; type: string }[]
  words: string[]
  areas: string[]
  twin: { name: string; username: string | null; look: string | null; shared: number } | null
  counts: { loves: number; nights: number; trips: number; games: number; stamps: number }
}

/** A year in taste, for the story set and its page (by the person's own id). */
export async function wrappedOf(personId: string, year: number): Promise<Wrapped | null> {
  const [person] = await db.select().from(schema.people).where(eq(schema.people.id, personId))
  if (!person?.isSelf) return null
  const [[account], [taste], loves, stamps] = await Promise.all([
    db
      .select({ username: schema.user.displayUsername, plain: schema.user.username })
      .from(schema.user)
      .where(eq(schema.user.id, person.ownerId)),
    db.select().from(schema.tastes).where(eq(schema.tastes.personId, person.id)),
    db
      .select()
      .from(schema.loves)
      .where(eq(schema.loves.personId, person.id))
      .orderBy(desc(schema.loves.weight), desc(schema.loves.createdAt))
      .limit(12),
    stampsOf(person.ownerId, year),
  ])
  const words = taste?.words as TasteWords | null
  const twin = await twinOf(person.ownerId)
  return {
    name: person.name,
    username: account?.username ?? account?.plain ?? null,
    look: person.look,
    city: person.city,
    year,
    loves: loves.map((l) => ({ name: l.name, image: l.imageUrl, type: l.type })),
    words: [...(words?.lifestyle ?? []), ...(words?.aesthetic ?? []), ...(words?.style ?? [])]
      .filter((w, i, all) => all.indexOf(w) === i)
      .slice(0, 8),
    areas: (taste?.areas ?? []).map((a) => a.name).slice(0, 3),
    twin,
    counts: {
      loves: stamps.filter((s) => s.kind === "love").length,
      nights: stamps.filter((s) => s.kind === "night" || s.kind === "table").length,
      trips: stamps.filter((s) => s.kind === "trip" || s.kind === "stay").length,
      games: stamps.filter((s) => s.kind === "game").length,
      stamps: stamps.length,
    },
  }
}

/** The public person who shares the most of their loves and picks. */
async function twinOf(userId: string): Promise<Wrapped["twin"]> {
  const rows = await db.execute<{
    name: string
    username: string | null
    look: string | null
    shared: number
  }>(sql`
    with mine as (
      select l.qloo_id from ${schema.loves} l join ${schema.people} p on p.id = l.person_id
      where p.owner_id = ${userId} and p.is_self
    )
    select p.name, u.display_username as username, p.look, count(*)::int as shared
    from ${schema.loves} l
    join ${schema.people} p on p.id = l.person_id
    join ${schema.user} u on u.id = p.owner_id
    join mine on mine.qloo_id = l.qloo_id
    where p.is_self and p.visibility = 'public' and p.owner_id <> ${userId}
    group by p.name, u.display_username, p.look
    order by shared desc limit 1`)
  const row = rows[0]
  return row ? { ...row, shared: Number(row.shared) } : null
}
