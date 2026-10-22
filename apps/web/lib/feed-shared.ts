import { FEED } from "@najimi/config"
import type { StoredPick } from "@najimi/db/schema"
import type { CardMedia } from "@najimi/sources"

/*
 * The feed's shapes and maths, shared by the server (pages) and the phone (dials, re-ranking).
 * Nothing here touches the network or the database.
 */

export type FeedDomain = keyof typeof FEED.mix
/** Each category's dial: 0 off, 1 less, 2 normal, 3 more. */
export type FeedMix = Record<FeedDomain, number>

export const FEED_DOMAINS = Object.keys(FEED.mix) as FeedDomain[]

export type FeedCard = {
  id: string
  type: string
  domain: FeedDomain
  name: string
  image: string | null
  caption: string | null
  affinity: number | null
  because: StoredPick["because"]
  shares: NonNullable<StoredPick["shares"]>
  callId: string
  links: Record<string, string>
  area: string | null
  details: string[]
  spotify: string | null
  media: CardMedia | null
  saved: boolean
}

export type FeedLove = {
  id: string
  qlooId: string
  name: string
  weight: number
  image: string | null
}

export type FeedPage = {
  state: "ready" | "building" | "empty"
  cards: FeedCard[]
  next: string | null
  /** The taste run to watch while the taste is still being built. */
  runId?: string | null
  /** Who the feed is for: their loves (the "why" sheet, the dials) and their mix. */
  meta?: { personId: string; mix: FeedMix; loves: FeedLove[]; city: string | null }
}

/** A person's dials, each 0 (off) … FEED.mixMax; Normal where they haven't turned one. */
export function mixOf(saved?: Record<string, number> | null): FeedMix {
  const mix = Object.fromEntries(FEED_DOMAINS.map((d) => [d, FEED.mixDefault])) as FeedMix
  for (const d of FEED_DOMAINS) {
    const v = saved?.[d]
    if (typeof v === "number" && Number.isFinite(v))
      mix[d] = Math.max(0, Math.min(FEED.mixMax, Math.round(v)))
  }
  return mix
}

/** Each category's share of the cards: its base share scaled by its dial. */
export const sharesOf = (mix: FeedMix): FeedMix =>
  Object.fromEntries(
    FEED_DOMAINS.map((d) => [d, FEED.mix[d] * (FEED.mixFactor[mix[d]] ?? 1)]),
  ) as FeedMix

export const mixKey = (mix: FeedMix) => FEED_DOMAINS.map((d) => mix[d]).join("")

/**
 * Which category fills each card: smooth weighted round-robin over the mix, so the heaviest
 * category comes first and the rest spread evenly between (music every two or three cards by
 * default). The sequence runs on across pages, so pages don't repeat one pattern.
 */
export function slotsFor(mix: Partial<FeedMix>, page: number, size: number): FeedDomain[] {
  const active = FEED_DOMAINS.filter((d) => (mix[d] ?? 0) > 0)
  if (!active.length) return []
  const total = active.reduce((sum, d) => sum + (mix[d] ?? 0), 0)
  const current = Object.fromEntries(active.map((d) => [d, 0])) as Record<FeedDomain, number>
  const out: FeedDomain[] = []
  const end = (page + 1) * size
  for (let step = 0; step < end; step++) {
    let best = active[0] as FeedDomain
    for (const d of active) {
      current[d] += mix[d] ?? 0
      if (current[d] > current[best]) best = d
    }
    current[best] -= total
    if (step >= page * size) out.push(best)
  }
  return out
}

/**
 * How well a card fits once love weights move, before Qloo answers again: its affinity scaled by
 * how much of it each love drove (explainability) under the new weights. 1 = unchanged.
 */
export function refit(
  card: Pick<FeedCard, "shares">,
  before: Record<string, number>,
  after: Record<string, number>,
): number {
  if (!card.shares.length) return 1
  let was = 0
  let now = 0
  for (const { id, share } of card.shares) {
    const key = id.toLowerCase()
    const w0 = before[key] ?? 0
    const w1 = after[key] ?? 0
    was += share * w0
    now += share * w1
  }
  return was > 0 ? now / was : 1
}
