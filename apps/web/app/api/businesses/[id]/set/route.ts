import { db, schema } from "@najimi/db"
import { songsFor } from "@najimi/sources"
import { eq } from "drizzle-orm"
import { fail, json } from "@/lib/api"
import { movesOf } from "@/lib/business-moves"
import { allow, clientAddress } from "@/lib/rate-limit"
import { getSession } from "@/lib/session"

type Params = { params: Promise<{ id: string }> }

const PER_ARTIST = 2
const ARTISTS = 6

/**
 * A move's set: songs by the artists it stands on (or, without any, the artists its people love
 * most), as Apple previews for the one player. For the owner, or anyone holding the plan's link.
 */
export async function GET(request: Request, { params }: Params) {
  if (!allow(`biz-set:${clientAddress(request)}`, 20, 60_000))
    return fail("Slow down a little", 429)
  const id = (await params).id
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("No such business", 404)
  const url = new URL(request.url)
  const [b] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, id))
  const session = await getSession()
  const token = url.searchParams.get("token")
  const mayRead =
    b && (b.ownerId === session?.user.id || (b.shareToken != null && token === b.shareToken))
  const report = b?.report
  if (!b || !mayRead || !report?.plan) return fail("No such business", 404)
  const move = movesOf(report.plan, b.name)[Number(url.searchParams.get("move") ?? 0)]
  const things = new Map(
    Object.values(report.fans).flatMap((list) => list.map((i) => [i.qlooId, i])),
  )
  const fromMove = (move?.evidence ?? []).flatMap((e) => {
    const thing = things.get(e)
    return thing?.type === "urn:entity:artist" ? [thing] : []
  })
  const artists = (fromMove.length ? fromMove : (report.fans["urn:entity:artist"] ?? [])).slice(
    0,
    ARTISTS,
  )
  const songs = await songsFor(artists.map((a) => ({ qlooId: a.qlooId, name: a.name }))).catch(
    () => ({}) as Awaited<ReturnType<typeof songsFor>>,
  )
  // One song from each artist, then the second round, so the set moves between them.
  const rounds = Array.from({ length: PER_ARTIST }, (_, round) =>
    artists.flatMap((a) => {
      const s = songs[a.qlooId]?.[round]
      return s
        ? [
            {
              id: `${a.qlooId}:${s.preview}`,
              src: s.preview,
              title: s.title,
              by: s.artist,
              artwork: s.artwork ?? a.image,
              store: s.store,
              pickId: a.qlooId,
            },
          ]
        : []
    }),
  )
  return json({ tracks: rounds.flat() })
}
