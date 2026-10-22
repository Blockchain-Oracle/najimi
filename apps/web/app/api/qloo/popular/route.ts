import { LOVES } from "@najimi/config"
import { qlooConfigured, search } from "@najimi/qloo"
import { fail, json } from "@/lib/api"
import { allow, clientAddress } from "@/lib/rate-limit"
import type { LoveHit } from "../search/route"

/** Found once per process; Qloo's answers are cached in Postgres too. */
let cached: { at: number; hits: LoveHit[] } | null = null
const KEEP_MS = 6 * 60 * 60 * 1000

/**
 * The sign-up's "pick 3" grid: well-known things across the domains as Qloo's own entities with
 * artwork. Public (looking at it starts no guest), limited per address.
 */
export async function GET(request: Request) {
  if (!qlooConfigured()) return fail("Qloo isn't connected yet", 503)
  if (!allow(`popular:${clientAddress(request)}`, 30, 60_000))
    return fail("Slow down a little", 429)
  if (cached && Date.now() - cached.at < KEEP_MS) return json({ hits: cached.hits })
  const found = await Promise.all(
    LOVES.popular.map(async ({ q, type }) => {
      const r = await search(
        { query: q, types: [type], take: 3 },
        { purpose: "Popular loves" },
      ).catch(() => null)
      const item = r?.data.find((i) => i.image) ?? r?.data[0]
      return item
        ? ({
            qlooId: item.entityId,
            type: item.type ?? type,
            name: item.name,
            image: item.image,
            caption: item.caption,
          } satisfies LoveHit)
        : null
    }),
  )
  const hits = found.filter((h): h is LoveHit => Boolean(h?.image))
  cached = { at: Date.now(), hits }
  return json({ hits })
}
