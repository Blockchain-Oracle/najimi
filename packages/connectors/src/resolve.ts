import { type CallContext, entities, search, type TasteItem } from "@najimi/qloo"
import type { Candidate } from "./feeds"

/** A candidate Qloo knows: what it is, and what it was called where it came from. */
export type Resolved = {
  qlooId: string
  name: string
  type: string
  image: string | null
  caption: string | null
  /** The name or handle it was imported as. */
  from: string
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")

const yearOf = (item: TasteItem): number | null => {
  const p = item.properties as { release_date?: string; release_year?: number }
  return p.release_year ?? (p.release_date ? Number(p.release_date.slice(0, 4)) : null)
}

const toResolved = (item: TasteItem, from: string): Resolved | null =>
  item.type
    ? {
        qlooId: item.entityId,
        name: item.name,
        type: item.type,
        image: item.image,
        caption: item.caption,
        from,
      }
    : null

/** The best `/search` hit for a name: an exact name first (and the right year for films). */
function pick(hits: TasteItem[], c: Candidate): TasteItem | null {
  const exact = hits.filter((h) => norm(h.name) === norm(c.name))
  const pool = exact.length ? exact : hits.slice(0, 1)
  if (c.year) {
    const sameYear = pool.find((h) => {
      const y = yearOf(h)
      return y !== null && Math.abs(y - (c.year ?? 0)) <= 1
    })
    if (sameYear) return sameYear
  }
  return pool[0] ?? null
}

/**
 * Matches candidates to Qloo: exact external ids first, then a name search for the rest. Unknown
 * things are dropped, never guessed; duplicates are merged.
 */
export async function resolve(candidates: Candidate[], ctx?: CallContext): Promise<Resolved[]> {
  const found = new Map<string, Resolved>()
  const unmatched: Candidate[] = []

  // One lookup per external id: `/entities` returns slim records without their external ids, so a
  // batch couldn't say which result belongs to which id. Each answer is cached for 30 days.
  const external = candidates.filter((c) => c.external)
  unmatched.push(...candidates.filter((c) => !c.external))
  await Promise.all(
    external.map(async (c) => {
      const ext = c.external
      if (!ext) return
      const r = await entities({ external: ext.kind, ids: [ext.id] }, ctx).catch(() => null)
      const hit = r?.data.find((item) => item.type) ?? null
      const handle = ext.kind === "twitter" || ext.kind === "instagram"
      const resolved = hit ? toResolved(hit, handle ? `@${c.name}` : c.name) : null
      if (resolved) found.set(resolved.qlooId, resolved)
      // A handle tried on both platforms may miss on one; a named thing still gets a search.
      else if (c.type) unmatched.push(c)
    }),
  )

  await Promise.all(
    unmatched.map(async (c) => {
      const r = await search(
        { query: c.name, types: c.type ? [c.type] : undefined, take: 5 },
        ctx,
      ).catch(() => null)
      const hit = r ? pick(r.data, c) : null
      const resolved = hit ? toResolved(hit, c.name) : null
      if (resolved && !found.has(resolved.qlooId)) found.set(resolved.qlooId, resolved)
    }),
  )
  return [...found.values()]
}
