import "server-only"
import { LOVES } from "@najimi/config"
import { qlooConfigured, search } from "@najimi/qloo"
import type { LoveHit } from "@/app/api/qloo/search/route"

/** Found once per process; Qloo's answers are cached in Postgres too. */
let kept: { at: number; hits: LoveHit[] } | null = null
const KEEP_MS = 6 * 60 * 60 * 1000

/**
 * Well-known things across the domains as Qloo's own entities with artwork: the sign-up's
 * "pick 3" grid and the landing's ring.
 */
export async function popularLoves(): Promise<LoveHit[]> {
  if (!qlooConfigured()) return []
  if (kept && Date.now() - kept.at < KEEP_MS) return kept.hits
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
  if (hits.length) kept = { at: Date.now(), hits }
  return hits
}
