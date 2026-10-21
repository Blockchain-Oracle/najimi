import { QLOO, TASTE, TASTE_DOMAINS } from "@najimi/config"
import type { StoredPick, TasteWords } from "@najimi/db/schema"
import { type CallContext, type CallResult, qlooCall } from "./call"
import { QlooError } from "./client"
import { entitiesOf, type TasteItem, tagsResponse, toTasteItem } from "./types"

/*
 * A person's taste, from the things they love: one weighted signal (`POST /v2/insights` with
 * `{ id, weight }` entities; GET can't carry weights). Explainability says which love drove each
 * pick: that's the "because" chip. Every function returns the call ids evidence points to.
 */

export type Love = { qlooId: string; name: string; weight: number; sparseDomains?: string[] }
export type Domain = (typeof TASTE_DOMAINS)[number]["key"]

const signalOf = (loves: Love[], domain?: string) => {
  const usable = domain ? loves.filter((l) => !l.sparseDomains?.includes(domain)) : loves
  return (usable.length ? usable : loves).map((l) => ({ id: l.qlooId, weight: l.weight }))
}

/** True when Qloo refused every love as a signal for this domain (a sparse seed). */
export const isInvalidSignal = (error: unknown) =>
  error instanceof QlooError && error.status === 400

type Insights = {
  filterType: string
  take?: number
  withImage?: boolean
  exclude?: string[]
  /** Tags the results must carry (`urn:tag:genre:place:restaurant`). */
  tags?: string[]
  /** Tags that join the signal (a mood: `urn:tag:keyword:media:rainy_day`). */
  signalTags?: string[]
  /** Places: around this city. */
  city?: string | null
  /** Rank these ids only (fit check). */
  only?: string[]
  extra?: Record<string, unknown>
}

/** One weighted insights call for a person's loves. */
export async function profileInsights(
  loves: Love[],
  input: Insights,
  ctx: CallContext = {},
  domain?: string,
): Promise<{ items: TasteItem[]; call: Pick<CallResult, "callId" | "status" | "cacheHit"> }> {
  const body: Record<string, unknown> = {
    "filter.type": input.filterType,
    "signal.interests.entities": signalOf(loves, domain),
    "feature.explainability": true,
    take: Math.min(input.take ?? TASTE.picksPerDomain, QLOO.takeMax),
    ...(input.withImage ? { "filter.exists": "properties.image" } : {}),
    ...(input.exclude?.length ? { "filter.exclude.entities": input.exclude.join(",") } : {}),
    ...(input.tags?.length ? { "filter.tags": input.tags.join(",") } : {}),
    ...(input.signalTags?.length ? { "signal.interests.tags": input.signalTags.join(",") } : {}),
    ...(input.city ? { "filter.location.query": input.city } : {}),
    ...(input.only?.length ? { "filter.results.entities": input.only.join(",") } : {}),
    ...input.extra,
  }
  const result = await qlooCall("/v2/insights", {}, ctx, body)
  if (result.status === 400) throw new QlooError("Qloo refused this signal", 400, false)
  return {
    items: entitiesOf(result.body).map(toTasteItem),
    call: { callId: result.callId, status: result.status, cacheHit: result.cacheHit },
  }
}

/** The love whose share of this pick is largest (explainability), or the heaviest love. */
export function becauseOf(item: TasteItem, loves: Love[]): StoredPick["because"] {
  const top = [...item.drivers].sort((a, b) => b.score - a.score)[0]
  const love = top
    ? loves.find((l) => l.qlooId.toLowerCase() === top.entityId.toLowerCase())
    : undefined
  if (love) return { qlooId: love.qlooId, name: love.name, share: top?.score ?? null }
  const heaviest = [...loves].sort((a, b) => b.weight - a.weight)[0]
  return heaviest ? { qlooId: heaviest.qlooId, name: heaviest.name, share: null } : null
}

const firstExternal = (item: TasteItem, key: string): string | null => {
  const value = item.external[key]
  const first = Array.isArray(value) ? value[0] : null
  return first && typeof first === "object" && "id" in first ? String(first.id) : null
}

/** Where "open" goes for each kind of pick (rule 3): real pages, never a made-up link. */
export function linksOf(item: TasteItem): Record<string, string> {
  const links: Record<string, string> = {}
  const p = item.properties as {
    official_site?: string
    website?: string
    menu_url?: string
    phone?: string
  }
  const q = encodeURIComponent(item.name)
  const wikidata = firstExternal(item, "wikidata")
  switch (item.type) {
    case "urn:entity:artist": {
      const spotify = firstExternal(item, "spotify")
      if (spotify) {
        links.spotify = `https://open.spotify.com/artist/${spotify}`
        links.embed = `https://open.spotify.com/embed/artist/${spotify}`
      }
      links.open = links.spotify ?? `https://open.spotify.com/search/${q}`
      break
    }
    case "urn:entity:podcast": {
      const itunes = item.handles.itunes
      links.open = itunes
        ? `https://podcasts.apple.com/podcast/id${itunes}`
        : `https://podcasts.apple.com/search?term=${q}`
      break
    }
    case "urn:entity:book":
      links.open = `https://openlibrary.org/search?q=${q}`
      break
    case "urn:entity:movie":
    case "urn:entity:tv_show":
    case "urn:entity:videogame":
      links.open = wikidata
        ? `https://www.wikidata.org/wiki/${wikidata.toUpperCase()}`
        : `https://www.themoviedb.org/search?query=${q}`
      break
    case "urn:entity:person":
      links.open = item.handles.instagram
        ? `https://www.instagram.com/${item.handles.instagram}`
        : item.handles.twitter
          ? `https://x.com/${item.handles.twitter}`
          : `https://www.wikidata.org/w/index.php?search=${q}`
      break
    case "urn:entity:brand":
      if (p.official_site ?? item.handles.website)
        links.open = (p.official_site ?? item.handles.website) as string
      break
    case "urn:entity:place":
    case "urn:entity:destination":
      if (item.location)
        links.map = `https://www.openstreetmap.org/?mlat=${item.location.lat}&mlon=${item.location.lon}#map=16/${item.location.lat}/${item.location.lon}`
      if (p.website) links.website = p.website
      if (p.menu_url) links.menu = p.menu_url
      if (p.phone) links.phone = `tel:${p.phone.replace(/[^+\d]/g, "")}`
      links.open = links.website ?? links.map ?? `https://www.openstreetmap.org/search?query=${q}`
      break
  }
  return links
}

/** A Qloo result as a stored pick: always with its call, its because and its links. */
export function toPick(item: TasteItem, loves: Love[], callId: string): StoredPick {
  return {
    qlooId: item.entityId,
    type: item.type ?? "",
    name: item.name,
    image: item.image,
    caption: item.caption,
    affinity: item.affinity,
    because: becauseOf(item, loves),
    callId,
    links: linksOf(item),
    ...(item.type === "urn:entity:place"
      ? {
          details: [
            ...new Set(
              item.tagRefs
                .filter(
                  (t) =>
                    /specialty_dish|cuisine/.test(t.type) ||
                    t.id.startsWith("urn:tag:genre:place:restaurant:"),
                )
                .map((t) => t.name.trim()),
            ),
          ].slice(0, 5),
        }
      : {}),
    ...(item.type === "urn:entity:place" || item.type === "urn:entity:destination"
      ? {
          area:
            (item.properties as { neighborhood?: string }).neighborhood ??
            (item.properties as { geocode?: { name?: string } }).geocode?.name ??
            null,
        }
      : {}),
  }
}

const DOMAIN_TYPE = Object.fromEntries(TASTE_DOMAINS.map((d) => [d.key, d.type])) as Record<
  Domain,
  string
>

/** Picks for one domain (places around the person's city). Empty when Qloo has nothing. */
export async function profilePicks(
  loves: Love[],
  domain: Domain,
  opts: {
    city?: string | null
    exclude?: string[]
    take?: number
    tags?: string[]
    signalTags?: string[]
  },
  ctx: CallContext = {},
): Promise<{ picks: StoredPick[]; callId: string | null; sparse: boolean }> {
  const meta = TASTE_DOMAINS.find((d) => d.key === domain)
  const local = domain === "place"
  if (local && !opts.city) return { picks: [], callId: null, sparse: false }
  try {
    const { items, call } = await profileInsights(
      loves,
      {
        filterType: DOMAIN_TYPE[domain],
        take: opts.take,
        withImage: Boolean(meta?.artwork),
        exclude: [...(opts.exclude ?? []), ...loves.map((l) => l.qlooId)],
        city: local ? opts.city : undefined,
        tags: opts.tags,
        signalTags: opts.signalTags,
      },
      ctx,
      domain,
    )
    return {
      picks: items.map((i) => toPick(i, loves, call.callId)),
      callId: call.callId,
      sparse: false,
    }
  } catch (error) {
    if (isInvalidSignal(error)) return { picks: [], callId: null, sparse: true }
    throw error
  }
}

const TAG_FAMILIES = {
  style: "urn:tag:style:qloo",
  decor: "urn:tag:decor:qloo",
  ambience: "urn:tag:ambience:qloo",
  cuisine: "urn:tag:cuisine:qloo",
  dishes: "urn:tag:specialty_dish:place",
} as const

/** Tag names come back with stray spaces and an occasional duplicate; clean and keep the order. */
const tidy = (names: string[]) => {
  const seen = new Set<string>()
  return names
    .map((n) => n.trim())
    .filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
}

/**
 * The words a taste is made of: the design language of the brands it loves (aesthetic and
 * lifestyle tags, weighted by affinity) plus Qloo's own style, decor, ambience, cuisine and dish
 * tags for the profile. These are what images and plans are built from (rule 2).
 */
export async function profileWords(
  loves: Love[],
  ctx: CallContext = {},
): Promise<{ words: TasteWords; callIds: string[] }> {
  const brandsCall = profileInsights(
    loves,
    { filterType: "urn:entity:brand", take: TASTE.brandsForWords },
    { ...ctx, purpose: "Brands your taste lives in" },
  )
  const familyCalls = Object.entries(TAG_FAMILIES).map(async ([family, tagType]) => {
    const body = {
      "filter.type": "urn:tag",
      "filter.tag.types": tagType,
      "signal.interests.entities": signalOf(loves),
      take: TASTE.wordsPerFamily,
    }
    const result = await qlooCall(
      "/v2/insights",
      {},
      { ...ctx, purpose: `Your ${family} words` },
      body,
    )
    const parsed = tagsResponse.safeParse(result.body)
    const names = parsed.success ? (parsed.data.results?.tags ?? []).map((t) => t.name) : []
    return { family, names: tidy(names), callId: result.callId }
  })
  const [brands, ...families] = await Promise.all([brandsCall.catch(() => null), ...familyCalls])

  const score = (prefix: string) => {
    const totals = new Map<string, number>()
    for (const item of brands?.items ?? [])
      for (const tag of item.tagRefs)
        if (tag.id.startsWith(prefix))
          totals.set(tag.name.trim(), (totals.get(tag.name.trim()) ?? 0) + (item.affinity ?? 0.5))
    return tidy([...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)).slice(
      0,
      TASTE.wordsPerFamily,
    )
  }
  const byFamily = Object.fromEntries(families.map((f) => [f.family, f.names]))
  return {
    words: {
      aesthetic: score("urn:tag:aesthetic_property:qloo"),
      lifestyle: score("urn:tag:lifestyle:qloo"),
      style: byFamily.style ?? [],
      decor: byFamily.decor ?? [],
      ambience: byFamily.ambience ?? [],
      cuisine: byFamily.cuisine ?? [],
      dishes: byFamily.dishes ?? [],
    },
    callIds: [brands?.call.callId, ...families.map((f) => f.callId)].filter((id): id is string =>
      Boolean(id),
    ),
  }
}

/** Place kinds and their Qloo genre tags (checked live 2026-10-21). */
export const PLACE_KINDS = {
  restaurant: "urn:tag:genre:place:restaurant",
  cafe: "urn:tag:genre:place:restaurant:cafe",
  bar: "urn:tag:genre:place:restaurant:bar",
  bookstore: "urn:tag:genre:place:book_store",
  museum: "urn:tag:genre:place:museum",
  gallery: "urn:tag:genre:place:art_gallery",
  hotel: "urn:tag:genre:place:hotel",
  park: "urn:tag:genre:place:park",
} as const
export type PlaceKind = keyof typeof PLACE_KINDS
