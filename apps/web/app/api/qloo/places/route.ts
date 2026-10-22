import { LOVES } from "@najimi/config"
import { qlooConfigured, search } from "@najimi/qloo"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

export type PlaceHit = {
  qlooId: string
  name: string
  caption: string | null
  lat: number
  lon: number
}

const query = z.object({ q: z.string().trim().min(LOVES.searchMinChars).max(80) })

/** Cities for the sign-up map: Qloo localities with their centre, so the pin lands where Qloo looks. */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!qlooConfigured()) return fail("Qloo isn't connected yet", 503)
  if (!allow(`places:${auth.session.user.id}`, 60, 60_000)) return fail("Slow down a little", 429)
  const input = query.safeParse({ q: new URL(request.url).searchParams.get("q") ?? "" })
  if (!input.success) return json({ places: [] })
  const r = await search(
    { query: input.data.q, types: ["urn:entity:locality"], take: LOVES.placesTake },
    { purpose: "Find your city" },
  )
  const places: PlaceHit[] = r.data.flatMap((item) =>
    item.location
      ? [{ qlooId: item.entityId, name: item.name, caption: item.caption, ...item.location }]
      : [],
  )
  return json({ places })
}
