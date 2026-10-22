import { staticMapUrl } from "@najimi/booking"
import { fail } from "@/lib/api"
import { planByToken } from "@/lib/plans"

/** The plan's route as a picture (Mapbox Static Images, fetched here so the token stays here). */
export async function GET(_: Request, ctx: RouteContext<"/api/plans/[token]/map">) {
  const plan = await planByToken((await ctx.params).token)
  if (!plan) return fail("Unknown plan", 404)
  const url = staticMapUrl(plan.stops, plan.route)
  if (!url) return fail("No map for this plan", 404)
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  if (!res?.ok || !res.body) return fail("The map didn't load", 502)
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "image/png",
      "cache-control": "public, max-age=86400, immutable",
    },
  })
}
