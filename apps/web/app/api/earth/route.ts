import { EARTH } from "@najimi/config"
import { explore } from "@najimi/qloo"
import { fail, json, withSession } from "@/lib/api"
import { lensesFor, lensOf } from "@/lib/earth"
import { allow } from "@/lib/rate-limit"

/**
 * A taste's heatmap over a city (W11): every cell Qloo scores (a ~1 km square), how strongly the
 * taste lives there overall and for each kind of thing. Yours, a friend's or a circle's.
 */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  if (!allow(`earth:${me}`, EARTH.perMinute, 60_000)) return fail("Slow down a little", 429)
  const params = new URL(request.url).searchParams
  const lens = await lensOf(params.get("who") ?? "me", me)
  if (!lens) return fail("Nothing to show", 404)
  const city = params.get("city")?.slice(0, 80) || lens.city
  const lenses = await lensesFor(me)
  if (!city || !lens.loves.length)
    return json({ lens: { ...lens, loves: undefined }, city, cells: [], lenses })
  const result = await explore(
    {
      filterType: "urn:heatmap",
      signal: { entities: lens.loves.map((l) => ({ id: l.qlooId, weight: l.weight })) },
      filter: { city },
    },
    lens.loves,
    { userId: me, purpose: `Where ${lens.name}'s taste lives in ${city}` },
  ).catch(() => null)
  const points = result?.kind === "heatmap" ? result.points : []
  const r3 = (n: number) => Math.round(n * 1000) / 1000
  return json({
    lens: { who: lens.who, name: lens.name, look: lens.look, city: lens.city, centre: lens.centre },
    city,
    callId: result?.callId ?? null,
    // Compact: [geohash, affinity, popularity, {kind: affinity}].
    cells: points.map((p) => [
      p.geohash,
      r3(p.affinity),
      p.popularity == null ? null : r3(p.popularity),
      Object.fromEntries(Object.entries(p.byType).map(([k, v]) => [k, r3(v)])),
    ]),
    lenses,
  })
}
