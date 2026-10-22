import { EARTH } from "@najimi/config"
import { sceneOf } from "@najimi/qloo"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"
import { peopleNear } from "@/lib/earth"
import { allow } from "@/lib/rate-limit"

const point = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
})

/** A spot's own scene (W12): its artists, brands, places and words, and the people who live near. */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  if (!allow(`earth-scene:${me}`, EARTH.perMinute, 60_000)) return fail("Slow down a little", 429)
  const parsed = point.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return fail("Pick a spot on the map", 400)
  const [scene, people] = await Promise.all([
    sceneOf(
      { ...parsed.data, radiusMeters: EARTH.sceneRadiusMeters },
      { userId: me, purpose: "The scene around a spot on the map" },
    ),
    peopleNear(parsed.data, me),
  ])
  return json({ scene, people })
}
