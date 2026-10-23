import { db, schema } from "@najimi/db"
import type { StoredPick } from "@najimi/db/schema"
import { songsFor } from "@najimi/sources"
import { and, desc, eq, gt, isNull } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"
import { selfOf } from "@/lib/people"

/**
 * What you can post besides a photo or a video, all from your own taste: songs by the artists you
 * love and were picked for you (Apple previews), your top picks, your plans to come, your Wrapped.
 */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const userId = auth.session.user.id
  const self = await selfOf(userId)
  if (!self) return fail("Pick a few loves first", 404)
  const [loves, [taste], plans, [wrapped]] = await Promise.all([
    db
      .select()
      .from(schema.loves)
      .where(and(eq(schema.loves.personId, self.id), eq(schema.loves.type, "urn:entity:artist")))
      .orderBy(desc(schema.loves.weight))
      .limit(6),
    db
      .select({ picks: schema.tastes.picks })
      .from(schema.tastes)
      .where(eq(schema.tastes.personId, self.id)),
    db
      .select({
        token: schema.plans.token,
        title: schema.plans.title,
        city: schema.plans.city,
        stops: schema.plans.stops,
        startsAt: schema.plans.startsAt,
      })
      .from(schema.plans)
      .where(
        and(
          eq(schema.plans.ownerId, userId),
          isNull(schema.plans.closedAt),
          gt(schema.plans.startsAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      )
      .orderBy(desc(schema.plans.startsAt))
      .limit(6),
    db
      .select({ token: schema.shares.token })
      .from(schema.shares)
      .where(
        and(
          eq(schema.shares.ownerId, userId),
          eq(schema.shares.kind, "wrapped"),
          eq(schema.shares.refId, self.id),
          isNull(schema.shares.revokedAt),
        ),
      ),
  ])
  const picks: Record<string, StoredPick[]> = taste?.picks ?? {}
  const artists = [
    ...loves.map((l) => ({
      qlooId: l.qlooId,
      name: l.name,
      image: l.imageUrl,
      wikidata: undefined,
    })),
    ...(picks.artist ?? []).slice(0, 6).map((p) => ({
      qlooId: p.qlooId,
      name: p.name,
      image: p.image,
      wikidata: p.ids?.wikidata,
    })),
  ]
  const songs = await songsFor(artists).catch(() => ({}) as Awaited<ReturnType<typeof songsFor>>)
  const top = Object.values(picks)
    .flatMap((list) => list.slice(0, 3))
    .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))
    .slice(0, 12)
  return json({
    songs: artists.flatMap((a) =>
      (songs[a.qlooId] ?? []).slice(0, 2).map((s) => ({
        title: s.title,
        artist: s.artist,
        preview: s.preview,
        store: s.store,
        artwork: s.artwork ?? a.image,
        thing: { qlooId: a.qlooId, type: "urn:entity:artist", name: a.name, image: a.image },
      })),
    ),
    picks: top.map((p) => ({ qlooId: p.qlooId, type: p.type, name: p.name, image: p.image })),
    plans: plans.flatMap((p) =>
      p.token
        ? [
            {
              token: p.token,
              title: p.title,
              city: p.city,
              image: p.stops.find((s) => s.image)?.image ?? null,
            },
          ]
        : [],
    ),
    wrapped: wrapped?.token ?? null,
  })
}
