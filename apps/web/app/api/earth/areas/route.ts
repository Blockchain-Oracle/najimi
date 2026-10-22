import { EARTH } from "@najimi/config"
import { explore, nameAreas } from "@najimi/qloo"
import { fail, json, withSession } from "@/lib/api"
import { lensOf } from "@/lib/earth"
import { allow } from "@/lib/rate-limit"

/** The heatmap's strongest areas, named by Qloo's own places (Victoria Island, Lekki…). */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  if (!allow(`earth-areas:${me}`, EARTH.perMinute, 60_000)) return fail("Slow down a little", 429)
  const params = new URL(request.url).searchParams
  const lens = await lensOf(params.get("who") ?? "me", me)
  if (!lens) return fail("Nothing to show", 404)
  const city = params.get("city")?.slice(0, 80) || lens.city
  if (!city || !lens.loves.length) return json({ areas: [] })
  const signal = { entities: lens.loves.map((l) => ({ id: l.qlooId, weight: l.weight })) }
  const ctx = { userId: me, purpose: `Where ${lens.name}'s taste lives in ${city}` }
  const result = await explore(
    { filterType: "urn:heatmap", signal, filter: { city } },
    lens.loves,
    ctx,
  ).catch(() => null)
  const points = result?.kind === "heatmap" ? result.points : []
  const areas = await nameAreas(points, signal, lens.loves, ctx, EARTH.areas, city).catch(() => [])
  return json({ areas })
}
