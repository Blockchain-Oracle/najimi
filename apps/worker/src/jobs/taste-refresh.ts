import { TASTE_DOMAINS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { StoredPick } from "@najimi/db/schema"
import { emit, setRunStatus } from "@najimi/live"
import {
  type Domain,
  explore,
  type Love,
  nameAreas,
  profilePicks,
  profileWords,
} from "@najimi/qloo"
import { asc, eq, sql } from "drizzle-orm"
import { auraFrom } from "../palette"

/** The loves a taste was computed from, as a key: a different key means the taste is stale. */
export const lovesKeyOf = (loves: { qlooId: string; weight: number }[]) =>
  loves
    .map((l) => `${l.qlooId}:${l.weight}`)
    .sort()
    .join(",")

const PURPOSE: Record<Domain, string> = {
  artist: "Music for your taste",
  movie: "Films for your taste",
  tv_show: "TV for your taste",
  book: "Books for your taste",
  podcast: "Podcasts for your taste",
  brand: "Brands for your taste",
  place: "Places near you for your taste",
  destination: "Destinations for your taste",
  videogame: "Games for your taste",
  person: "People for your taste",
}

/**
 * Computes a person's taste and streams it to the reveal: the words first, then each domain's
 * picks as they land. Saved as it goes (a reload shows what's there), and only if the loves are
 * still the ones it started from (a newer run owns a changed taste).
 */
export async function tasteRefresh(personId: string, runId: string): Promise<void> {
  const [person] = await db.select().from(schema.people).where(eq(schema.people.id, personId))
  if (!person) return setRunStatus(runId, "failed", "That person is gone")
  const rows = await db
    .select()
    .from(schema.loves)
    .where(eq(schema.loves.personId, personId))
    .orderBy(asc(schema.loves.createdAt))
  if (!rows.length) return setRunStatus(runId, "failed", "Add something they love first")

  await setRunStatus(runId, "running")
  const loves: Love[] = rows.map((r) => ({
    qlooId: r.qlooId,
    name: r.name,
    weight: r.weight,
    sparseDomains: r.sparseDomains,
  }))
  const key = lovesKeyOf(rows)
  const ctx = { userId: person.ownerId, runId }
  const stillCurrent = async () => {
    const now = await db.select().from(schema.loves).where(eq(schema.loves.personId, personId))
    return lovesKeyOf(now) === key
  }
  await db
    .insert(schema.tastes)
    .values({ personId, runId, lovesKey: key })
    .onConflictDoUpdate({ target: schema.tastes.personId, set: { runId, lovesKey: key } })

  // Their colours, from the artwork of what they love most (the orb, the aura, the washes).
  const art = [...rows]
    .sort((a, b) => b.weight - a.weight)
    .flatMap((r) => (r.imageUrl ? [r.imageUrl] : []))
  const aura = await auraFrom(art).catch(() => null)
  if (aura) {
    await db.update(schema.people).set({ aura }).where(eq(schema.people.id, personId))
    await emit(runId, "aura", { aura })
  }

  await emit(runId, "stage", { stage: "words" })
  const { words } = await profileWords(loves, ctx)
  await emit(runId, "words", { words })
  if (await stillCurrent())
    await db.update(schema.tastes).set({ words }).where(eq(schema.tastes.personId, personId))

  const picks: Record<string, StoredPick[]> = {}
  const empty: string[] = []
  await Promise.all(
    TASTE_DOMAINS.map(async ({ key: domain }) => {
      try {
        const result = await profilePicks(
          loves,
          domain,
          { city: person.city, exclude: person.excludedIds },
          { ...ctx, purpose: PURPOSE[domain] },
        )
        picks[domain] = result.picks
        if (!result.picks.length) empty.push(domain)
        await emit(runId, "picks", { domain, picks: result.picks, sparse: result.sparse })
      } catch (error) {
        empty.push(domain)
        await emit(runId, "picks", { domain, picks: [], error: (error as Error).message })
      }
    }),
  )

  // Where people with this taste are in their city: Qloo's heatmap, its strongest areas named by
  // the places inside them that fit this taste.
  let areas: Awaited<ReturnType<typeof nameAreas>> = []
  if (person.city) {
    await emit(runId, "stage", { stage: "areas" })
    try {
      const signal = { entities: loves.map((l) => ({ id: l.qlooId, weight: l.weight })) }
      const map = await explore(
        { filterType: "urn:heatmap", signal, filter: { city: person.city } },
        loves,
        { ...ctx, purpose: `Where your people are in ${person.city}` },
      )
      if (map.kind === "heatmap" && map.points.length)
        areas = await nameAreas(
          map.points,
          signal,
          loves,
          { ...ctx, purpose: `Naming the areas in ${person.city}` },
          3,
          person.city,
        )
    } catch {
      areas = []
    }
    await emit(runId, "areas", { areas })
  }

  // What the taste bridged: from a love in one domain to the top pick in another.
  const bridges = TASTE_DOMAINS.flatMap(({ key: domain }) => {
    const top = picks[domain]?.[0]
    return top?.because ? [{ from: top.because.name, to: top.name, domain }] : []
  })

  if (await stillCurrent()) {
    await db
      .update(schema.tastes)
      .set({
        picks,
        bridges,
        areas,
        computedAt: new Date(),
        version: sql`${schema.tastes.version} + 1`,
      })
      .where(eq(schema.tastes.personId, personId))
  }
  await emit(runId, "bridges", { bridges, empty })
  await setRunStatus(runId, "done")
}
