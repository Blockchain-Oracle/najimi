import { LOVES, TASTE_DOMAINS } from "@najimi/config"
import { qlooConfigured, search } from "@najimi/qloo"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

export type LoveHit = {
  qlooId: string
  type: string
  name: string
  image: string | null
  caption: string | null
}

const query = z.object({
  q: z.string().trim().min(LOVES.searchMinChars).max(120),
  type: z.enum(TASTE_DOMAINS.map((d) => d.key) as [string, ...string[]]).optional(),
})

/**
 * The loves typeahead (T2): Qloo's own entities across every domain, with artwork. Signed-in or
 * guest only, rate-limited per person; the answers come from the private cache after the first time.
 */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!qlooConfigured()) return fail("Qloo isn't connected yet", 503)
  if (!allow(`search:${auth.session.user.id}`, 90, 60_000)) return fail("Slow down a little", 429)
  const url = new URL(request.url)
  const input = query.safeParse({
    q: url.searchParams.get("q") ?? "",
    type: url.searchParams.get("type") || undefined,
  })
  if (!input.success) return json({ hits: [] })
  const types = input.data.type
    ? [TASTE_DOMAINS.find((d) => d.key === input.data.type)?.type ?? ""]
    : TASTE_DOMAINS.map((d) => d.type)
  const r = await search(
    { query: input.data.q, types, take: LOVES.searchTake },
    { purpose: "Find what you love" },
  )
  const known = new Set<string>(TASTE_DOMAINS.map((d) => d.type))
  const hits: LoveHit[] = r.data
    .filter((item) => item.type && known.has(item.type))
    .map((item) => ({
      qlooId: item.entityId,
      type: item.type ?? "",
      name: item.name,
      image: item.image,
      caption: item.caption,
    }))
  return json({ hits })
}
