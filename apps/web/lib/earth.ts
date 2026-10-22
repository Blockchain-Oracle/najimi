import "server-only"
import { db, schema } from "@najimi/db"
import { distanceKm } from "@najimi/geo"
import { blendLoves, type Love } from "@najimi/qloo"
import { and, asc, eq, isNotNull, ne } from "drizzle-orm"
import { isMember } from "@/lib/chat/store"
import { selfOf } from "@/lib/people"
import { blockedWith, profileByUsername } from "@/lib/social"

/*
 * The Earth's lenses (W11): whose taste the map shows (yours, a friend's, a circle's blended so
 * everyone counts the same), and the people on the globe.
 */

export type Lens = {
  /** me, u:<username>, c:<chatId> */
  who: string
  name: string
  look: string | null
  loves: Love[]
  city: string | null
  centre: { lat: number; lon: number } | null
}

const lovesOf = async (personId: string): Promise<Love[]> =>
  (
    await db
      .select()
      .from(schema.loves)
      .where(eq(schema.loves.personId, personId))
      .orderBy(asc(schema.loves.createdAt))
  ).map((l) => ({ qlooId: l.qlooId, name: l.name, weight: l.weight }))

const centreOf = (p: { cityLat: number | null; cityLon: number | null }) =>
  p.cityLat != null && p.cityLon != null ? { lat: p.cityLat, lon: p.cityLon } : null

/** Whose taste to draw, if the viewer may see it. */
export async function lensOf(who: string, viewerId: string): Promise<Lens | null> {
  if (who === "me") {
    const self = await selfOf(viewerId)
    if (!self) return null
    return {
      who,
      name: self.name,
      look: self.look,
      loves: await lovesOf(self.id),
      city: self.city,
      centre: centreOf(self),
    }
  }
  if (who.startsWith("u:")) {
    const profile = await profileByUsername(who.slice(2), viewerId)
    if (!profile || profile.hidden) return null
    const p = profile.row.person
    return {
      who,
      name: p.name,
      look: p.look,
      loves: profile.loves.map((l) => ({ qlooId: l.qlooId, name: l.name, weight: l.weight })),
      city: p.city,
      centre: centreOf(p),
    }
  }
  if (who.startsWith("c:")) {
    const chatId = who.slice(2)
    if (!(await isMember(chatId, viewerId))) return null
    const [chat] = await db
      .select({ name: schema.chats.name })
      .from(schema.chats)
      .where(eq(schema.chats.id, chatId))
    const members = await db
      .select({ person: schema.people })
      .from(schema.chatMembers)
      .innerJoin(
        schema.people,
        and(eq(schema.people.ownerId, schema.chatMembers.userId), eq(schema.people.isSelf, true)),
      )
      .where(eq(schema.chatMembers.chatId, chatId))
    if (!members.length) return null
    const me = members.find((m) => m.person.ownerId === viewerId)?.person
    const anchor = me?.city ? me : (members.find((m) => m.person.city)?.person ?? null)
    return {
      who,
      name: chat?.name ?? "Circle",
      look: null,
      loves: blendLoves(await Promise.all(members.map((m) => lovesOf(m.person.id)))),
      city: anchor?.city ?? null,
      centre: anchor ? centreOf(anchor) : null,
    }
  }
  return null
}

/** Who the viewer can draw: themself, friends and people they follow, their circles. */
export async function lensesFor(viewerId: string) {
  const [following, circles] = await Promise.all([
    db
      .select({
        name: schema.people.name,
        look: schema.people.look,
        username: schema.user.displayUsername,
        visibility: schema.people.visibility,
      })
      .from(schema.follows)
      .innerJoin(
        schema.people,
        and(eq(schema.people.ownerId, schema.follows.followeeId), eq(schema.people.isSelf, true)),
      )
      .innerJoin(schema.user, eq(schema.user.id, schema.follows.followeeId))
      .where(and(eq(schema.follows.followerId, viewerId), ne(schema.people.visibility, "private")))
      .limit(20),
    db
      .select({ id: schema.chats.id, name: schema.chats.name })
      .from(schema.chatMembers)
      .innerJoin(schema.chats, eq(schema.chats.id, schema.chatMembers.chatId))
      .where(and(eq(schema.chatMembers.userId, viewerId), eq(schema.chats.kind, "circle")))
      .limit(12),
  ])
  return {
    people: following.flatMap((f) =>
      f.username ? [{ who: `u:${f.username.toLowerCase()}`, name: f.name, look: f.look }] : [],
    ),
    circles: circles.map((c) => ({ who: `c:${c.id}`, name: c.name ?? "Circle" })),
  }
}

/**
 * People on the globe: everyone public with a city, placed a short, steady hop from their city's
 * centre (so a city's people don't stack on one pin, and nobody's street shows).
 */
export async function peopleOnEarth(viewerId: string, limit = 300) {
  const rows = await db
    .select({
      userId: schema.people.ownerId,
      name: schema.people.name,
      look: schema.people.look,
      city: schema.people.city,
      lat: schema.people.cityLat,
      lon: schema.people.cityLon,
      username: schema.user.displayUsername,
    })
    .from(schema.people)
    .innerJoin(schema.user, eq(schema.user.id, schema.people.ownerId))
    .where(
      and(
        eq(schema.people.isSelf, true),
        eq(schema.people.visibility, "public"),
        isNotNull(schema.people.cityLat),
        isNotNull(schema.people.cityLon),
        ne(schema.people.ownerId, viewerId),
      ),
    )
    .limit(limit)
  const blocked = await blockedWith(viewerId)
  return rows
    .filter((r) => !blocked.has(r.userId))
    .map((r) => {
      let h = 0
      for (const ch of r.userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
      const angle = ((h % 360) * Math.PI) / 180
      const hop = 0.012 + ((h >>> 9) % 100) / 4000
      return {
        userId: r.userId,
        name: r.name,
        look: r.look,
        city: r.city,
        username: r.username,
        lat: (r.lat as number) + Math.sin(angle) * hop,
        lon: (r.lon as number) + Math.cos(angle) * hop,
      }
    })
}

/** Public people whose city is near a spot (a scene's locals). */
export async function peopleNear(point: { lat: number; lon: number }, viewerId: string, km = 25) {
  const all = await peopleOnEarth(viewerId, 500)
  return all
    .map((p) => ({ ...p, km: distanceKm(point, p) }))
    .filter((p) => p.km <= km)
    .sort((a, b) => a.km - b.km)
    .slice(0, 12)
}
