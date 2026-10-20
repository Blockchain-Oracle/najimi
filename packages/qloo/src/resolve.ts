import { entities, insights, search } from "./api"
import type { CallContext } from "./call"
import type { TasteItem } from "./types"

/*
 * Finding a business in Qloo (plan §3, F2). Order: exact external ids from the site → name search
 * (with location for places) → accept only with real evidence (same website, same address, or an
 * exact id) → otherwise show the candidates and let the owner confirm (SAFE_USE: show resolved
 * matches when ambiguous). Then comparables: a brand's own competitive set, a place's neighbours,
 * or the names the site suggests. Never invents a match (R12).
 */

export type BusinessKind = "place" | "brand" | "artist" | "other"

export type BusinessFacts = {
  name: string
  kind: BusinessKind
  website: string
  address?: string | null
  city?: string | null
  lat?: number | null
  lon?: number | null
  socials?: Partial<Record<"instagram" | "twitter" | "facebook" | "spotify", string>>
  wikidata?: string | null
  /** Comparable businesses the site reading proposed (names only). */
  comparableNames?: string[]
}

export type Evidence = "website" | "address" | "external-id" | "name"

export type Candidate = { item: TasteItem; evidence: Evidence[]; score: number }

export type Resolution = {
  status: "matched" | "ambiguous" | "not-found"
  own: Candidate | null
  candidates: Candidate[]
  comparables: TasteItem[]
  /** How the comparables were found, in plain words, for the report's honesty line (R12). */
  comparablesRoute: "competitive-set" | "neighbours" | "site-suggestions" | "none"
  callIds: string[]
}

const TYPES_BY_KIND: Record<BusinessKind, string[]> = {
  place: ["urn:entity:place"],
  brand: ["urn:entity:brand"],
  artist: ["urn:entity:artist"],
  other: ["urn:entity:place", "urn:entity:brand"],
}

const STRONG: Evidence[] = ["website", "address", "external-id"]

export function hostOf(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(
      /^www\./,
      "",
    )
  } catch {
    return null
  }
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/** Share of name words in common (Jaccard), 0–1. */
export function nameSimilarity(a: string, b: string): number {
  const x = new Set(words(a))
  const y = new Set(words(b))
  if (!x.size || !y.size) return 0
  let common = 0
  for (const w of x) if (y.has(w)) common++
  return common / (x.size + y.size - common)
}

/** Same street number and at least two street words in common. */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const wa = words(a)
  const wb = new Set(words(b))
  const numberA = wa.find((w) => /^\d+[a-z]?$/.test(w))
  if (!numberA || !wb.has(numberA)) return false
  return wa.filter((w) => !/^\d/.test(w) && w.length > 2 && wb.has(w)).length >= 2
}

const NAME_THRESHOLD = 0.5

function score(item: TasteItem, facts: BusinessFacts, viaExternal: boolean): Candidate {
  const evidence: Evidence[] = []
  const siteHost = hostOf(facts.website)
  const itemHost = hostOf(item.properties.website ?? item.properties.official_site)
  if (siteHost && itemHost && siteHost === itemHost) evidence.push("website")
  if (sameAddress(facts.address, item.properties.address)) evidence.push("address")
  if (viaExternal) evidence.push("external-id")
  const similarity = nameSimilarity(facts.name, item.name)
  if (similarity >= NAME_THRESHOLD) evidence.push("name")
  const strong = evidence.filter((e) => STRONG.includes(e)).length
  return { item, evidence, score: strong * 10 + similarity }
}

export async function resolveBusiness(
  facts: BusinessFacts,
  ctx: CallContext = {},
): Promise<Resolution> {
  const callIds: string[] = []
  const found = new Map<string, Candidate>()
  const add = (items: TasteItem[], viaExternal: boolean) => {
    for (const item of items) {
      const next = score(item, facts, viaExternal)
      const prev = found.get(item.entityId)
      if (!prev || next.score > prev.score) found.set(item.entityId, next)
    }
  }

  // 1. Exact ids the site gives away (footer social links, Wikidata sameAs).
  const externals: [string, string | undefined | null][] = [
    ["wikidata", facts.wikidata],
    ["instagram", facts.socials?.instagram],
    ["twitter", facts.socials?.twitter],
    ["facebook", facts.socials?.facebook],
    ["spotify", facts.socials?.spotify],
  ]
  for (const [external, id] of externals) {
    if (!id) continue
    const r = await entities(
      { external, ids: [id] },
      { ...ctx, purpose: `Find you in Qloo by your ${external}` },
    )
    callIds.push(r.call.callId)
    add(r.data, true)
  }

  // 2. Name search, near the address for places.
  const near =
    facts.kind === "place" && facts.lat != null && facts.lon != null
      ? { lat: facts.lat, lon: facts.lon }
      : undefined
  const named = await search(
    {
      query: facts.name,
      types: TYPES_BY_KIND[facts.kind],
      location: near,
      sortBy: near ? "distance" : undefined,
      take: 5,
    },
    { ...ctx, purpose: "Find you in Qloo by name" },
  )
  callIds.push(named.call.callId)
  add(named.data, false)

  const candidates = [...found.values()].sort((a, b) => b.score - a.score)
  const confident = candidates.filter((c) => c.evidence.some((e) => STRONG.includes(e)))
  const own = confident.length === 1 ? (confident[0] ?? null) : null
  const status: Resolution["status"] = own
    ? "matched"
    : candidates.length
      ? "ambiguous"
      : "not-found"

  const { comparables, route, ids } = await findComparables(facts, own?.item ?? null, ctx)
  callIds.push(...ids)
  return {
    status,
    own,
    candidates: candidates.slice(0, 5),
    comparables,
    comparablesRoute: route,
    callIds,
  }
}

/** 3–5 businesses like this one, from the best route available. */
export async function findComparables(
  facts: BusinessFacts,
  own: TasteItem | null,
  ctx: CallContext = {},
): Promise<{ comparables: TasteItem[]; route: Resolution["comparablesRoute"]; ids: string[] }> {
  const ids: string[] = []
  const MAX = 5

  const competitive = own?.properties.competitive_set ?? []
  if (own && competitive.length) {
    const items: TasteItem[] = []
    for (const name of competitive.slice(0, MAX)) {
      const r = await search(
        { query: name, types: ["urn:entity:brand"], take: 1 },
        { ...ctx, purpose: `Find ${name} in Qloo` },
      )
      ids.push(r.call.callId)
      if (r.data[0]) items.push(r.data[0])
    }
    if (items.length) return { comparables: items, route: "competitive-set", ids }
  }

  if (own && facts.kind === "place" && facts.city) {
    const r = await insights(
      {
        filterType: "urn:entity:place",
        signalEntities: [own.entityId],
        take: MAX,
        extra: { "filter.location.query": facts.city, "filter.exclude.entities": [own.entityId] },
      },
      { ...ctx, purpose: "Places like yours nearby" },
    )
    ids.push(r.call.callId)
    if (r.data.length) return { comparables: r.data, route: "neighbours", ids }
  }

  const items: TasteItem[] = []
  for (const name of (facts.comparableNames ?? []).slice(0, MAX)) {
    const r = await search(
      { query: name, types: TYPES_BY_KIND[facts.kind], take: 1 },
      { ...ctx, purpose: `Find ${name} in Qloo` },
    )
    ids.push(r.call.callId)
    if (r.data[0]) items.push(r.data[0])
  }
  return { comparables: items, route: items.length ? "site-suggestions" : "none", ids }
}
