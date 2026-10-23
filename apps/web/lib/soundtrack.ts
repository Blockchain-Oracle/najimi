import "server-only"
import { TASTE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { blendLoves, profilePicks } from "@najimi/qloo"
import { songsFor } from "@najimi/sources"
import { and, eq, inArray } from "drizzle-orm"

/*
 * A circle's soundtrack: Qloo's artists for everyone's loves blended equally (each member counts
 * the same), each with a couple of Apple previews, played in order through the one player. The
 * artists are kept per set of loves in `circle_tastes`, so a circle asks Qloo again only when
 * someone's taste changes.
 */

export type SoundtrackTrack = {
  id: string
  src: string
  title: string
  by: string
  artwork: string | null
  store: string
  pickId: string
}

const PER_ARTIST = 2
const ARTISTS = 8

export async function soundtrackOf(chatId: string, userId: string): Promise<SoundtrackTrack[]> {
  const members = await db
    .select({ personId: schema.people.id })
    .from(schema.chatMembers)
    .innerJoin(
      schema.people,
      and(eq(schema.people.ownerId, schema.chatMembers.userId), eq(schema.people.isSelf, true)),
    )
    .where(eq(schema.chatMembers.chatId, chatId))
  if (!members.length) return []
  const loves = await db
    .select({
      personId: schema.loves.personId,
      qlooId: schema.loves.qlooId,
      name: schema.loves.name,
      weight: schema.loves.weight,
    })
    .from(schema.loves)
    .where(
      inArray(
        schema.loves.personId,
        members.map((m) => m.personId),
      ),
    )
  const lovesBy = members.map((m) => loves.filter((l) => l.personId === m.personId))
  if (!lovesBy.some((l) => l.length)) return []
  const key = loves
    .map((l) => `${l.qlooId}:${l.weight}`)
    .sort()
    .join("|")

  const [kept] = await db
    .select()
    .from(schema.circleTastes)
    .where(eq(schema.circleTastes.chatId, chatId))
  let artists = kept?.key === key ? kept.picks?.artist : undefined
  if (!artists) {
    const found = await profilePicks(
      blendLoves(lovesBy, 24, TASTE.weightMax),
      "artist",
      { take: ARTISTS },
      { userId, chatId, purpose: "The circle's soundtrack" },
    ).catch(() => null)
    artists = found?.picks ?? []
    if (artists.length)
      await db
        .insert(schema.circleTastes)
        .values({ chatId, key, picks: { artist: artists }, computedAt: new Date() })
        .onConflictDoUpdate({
          target: schema.circleTastes.chatId,
          set: { key, picks: { ...(kept?.picks ?? {}), artist: artists }, computedAt: new Date() },
        })
  }
  const songs = await songsFor(
    artists.map((a) => ({ qlooId: a.qlooId, name: a.name, wikidata: a.ids?.wikidata })),
  ).catch(() => ({}) as Awaited<ReturnType<typeof songsFor>>)
  // One song from each artist, then the second round, so the mix moves between them.
  const rounds: SoundtrackTrack[][] = Array.from({ length: PER_ARTIST }, () => [])
  for (const a of artists)
    (songs[a.qlooId] ?? []).slice(0, PER_ARTIST).forEach((s, i) => {
      rounds[i]?.push({
        id: `${a.qlooId}:${s.preview}`,
        src: s.preview,
        title: s.title,
        by: s.artist,
        artwork: s.artwork ?? a.image,
        store: s.store,
        pickId: a.qlooId,
      })
    })
  return rounds.flat()
}
