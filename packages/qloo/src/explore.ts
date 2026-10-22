import { QLOO } from "@najimi/config"
import type { StoredPick } from "@najimi/db/schema"
import { type CallContext, qlooCall } from "./call"
import { QlooError } from "./client"
import { type Love, NOT_OUTINGS, OUTING_TAGS, toPick } from "./taste"
import {
  demographicsResponse,
  entitiesOf,
  heatmapResponse,
  tagsResponse,
  toTasteItem,
} from "./types"

/*
 * The whole Insights API as one structured request, so the agent can ask Qloo anything it can
 * answer: any entity type, tag analysis, a heatmap or demographics; signals from a person's loves,
 * from any entities or tags, from an age, a gender, an audience or a place; and every filter the
 * API documents (location, years, popularity, ratings, price, tags, exclusions…). It's a JSON POST,
 * the only way Qloo takes weighted signals.
 */

export type Range = { min?: number; max?: number }

export type ExploreInput = {
  /** `urn:entity:<type>`, or `urn:tag` / `urn:heatmap` / `urn:demographics`. */
  filterType: string
  signal?: {
    entities?: { id: string; weight?: number }[]
    tags?: string[]
    age?: string
    gender?: "male" | "female"
    audiences?: string[]
    /** "The taste of people in Lagos." */
    location?: string
    /** The taste of a spot on the map (a neighbourhood's own scene), with no person in it. */
    point?: { lat: number; lon: number; radiusMeters?: number }
  }
  filter?: {
    city?: string
    radiusMeters?: number
    excludeCity?: string
    tags?: string[]
    tagsMode?: "any" | "all"
    excludeTags?: string[]
    /** urn:tag only: which kinds of words (`urn:tag:decor:qloo`…). */
    tagTypes?: string[]
    /** urn:tag only: words that belong to this domain (`urn:entity:place`). */
    parentTypes?: string[]
    popularity?: Range
    releaseYear?: Range
    publicationYear?: Range
    finaleYear?: Range
    rating?: Range
    contentRating?: string
    releaseCountry?: string[]
    priceLevel?: Range
    hotelClass?: Range
    businessRating?: Range
    openOn?: string
    countryCode?: string
    externalExists?: string[]
    /** Score exactly these entities (a fit check). */
    onlyIds?: string[]
    exclude?: string[]
    geohash?: string
    /** Results near a spot on the map. */
    point?: { lat: number; lon: number; radiusMeters?: number }
  }
  /** One result per city (or metro). */
  diversifyBy?: "city" | "metro"
  /** Only results with artwork. */
  withImage?: boolean
  take?: number
  page?: number
}

const range = (prefix: string, r: Range | undefined) =>
  r
    ? {
        ...(r.min !== undefined ? { [`${prefix}.min`]: r.min } : {}),
        ...(r.max !== undefined ? { [`${prefix}.max`]: r.max } : {}),
      }
    : {}

const list = (v: string[] | undefined) => (v?.length ? v.join(",") : undefined)

/** The POST body for an explore request (undefined values are dropped by the cache key). */
export function exploreBody(input: ExploreInput): Record<string, unknown> {
  const s = input.signal ?? {}
  const f = input.filter ?? {}
  const isEntity = input.filterType.startsWith("urn:entity:")
  return Object.fromEntries(
    Object.entries({
      "filter.type": input.filterType,
      "signal.interests.entities": s.entities?.length
        ? s.entities.map((e) => ({ id: e.id, weight: e.weight ?? 5 }))
        : undefined,
      "signal.interests.tags": list(s.tags),
      "signal.demographics.age": s.age,
      "signal.demographics.gender": s.gender,
      "signal.demographics.audiences": list(s.audiences),
      "signal.location.query": s.location,
      "signal.location": s.point ? `POINT(${s.point.lon} ${s.point.lat})` : undefined,
      "signal.location.radius": s.point?.radiusMeters,
      "filter.location.query": f.city,
      "filter.location": f.point ? `POINT(${f.point.lon} ${f.point.lat})` : undefined,
      "filter.location.radius": f.point?.radiusMeters ?? f.radiusMeters,
      "filter.exclude.location.query": f.excludeCity,
      "filter.tags": list(f.tags),
      "operator.filter.tags": f.tags?.length && f.tagsMode === "all" ? "intersection" : undefined,
      "filter.exclude.tags": list(f.excludeTags),
      "filter.tag.types": list(f.tagTypes),
      "filter.parents.types": list(f.parentTypes),
      ...range("filter.popularity", f.popularity),
      ...range("filter.release_year", f.releaseYear),
      ...range("filter.publication_year", f.publicationYear),
      ...range("filter.finale_year", f.finaleYear),
      ...range("filter.rating", f.rating),
      ...range("filter.price_level", f.priceLevel),
      ...range("filter.hotel_class", f.hotelClass),
      ...range("filter.properties.business_rating", f.businessRating),
      "filter.content_rating": f.contentRating,
      "filter.release_country": list(f.releaseCountry),
      "filter.hours": f.openOn,
      "filter.geocode.country_code": f.countryCode,
      "filter.external.exists": list(f.externalExists),
      "filter.results.entities": list(f.onlyIds),
      "filter.exclude.entities": list(f.exclude),
      "filter.location.geohash": f.geohash,
      "diversify.by": input.diversifyBy ? `properties.geocode.${input.diversifyBy}` : undefined,
      "diversify.take": input.diversifyBy ? 1 : undefined,
      "feature.explainability": isEntity ? true : undefined,
      "filter.exists": input.withImage && isEntity ? "properties.image" : undefined,
      take: Math.min(input.take ?? 8, QLOO.takeMax),
      page: input.page,
    }).filter(([, v]) => v !== undefined),
  )
}

export type ExploreResult =
  | { kind: "entities"; picks: StoredPick[]; callId: string }
  | {
      kind: "tags"
      tags: { id: string; name: string; type: string; affinity: number | null }[]
      callId: string
    }
  | {
      kind: "heatmap"
      points: {
        lat: number
        lon: number
        geohash: string
        affinity: number
        popularity: number | null
        /** Each kind of thing's own affinity here (`artist`, `place`, `tv_show`…). */
        byType: Record<string, number>
      }[]
      callId: string
    }
  | {
      kind: "demographics"
      age: Record<string, number>
      gender: Record<string, number>
      callId: string
    }

/** Runs an explore request and parses whatever kind of answer it asked for. */
export async function explore(
  input: ExploreInput,
  loves: Love[],
  ctx: CallContext = {},
): Promise<ExploreResult> {
  const result = await qlooCall("/v2/insights", {}, ctx, exploreBody(input))
  if (result.status >= 400) {
    const message = (result.body as { errors?: { message?: string }[] })?.errors?.[0]?.message
    throw new QlooError(message ?? `Qloo answered ${result.status}`, result.status, false)
  }
  const callId = result.callId
  if (input.filterType === "urn:tag") {
    const parsed = tagsResponse.safeParse(result.body)
    const tags = parsed.success ? (parsed.data.results?.tags ?? []) : []
    return {
      kind: "tags",
      callId,
      tags: tags.map((t) => ({
        id: t.id ?? t.tag_id ?? "",
        name: t.name.trim(),
        type: t.subtype ?? t.types?.[0] ?? "",
        affinity: t.query?.affinity ?? null,
      })),
    }
  }
  if (input.filterType === "urn:heatmap") {
    const parsed = heatmapResponse.safeParse(result.body)
    const points = parsed.success ? (parsed.data.results?.heatmap ?? []) : []
    return {
      kind: "heatmap",
      callId,
      points: points.map((p) => ({
        lat: p.location.latitude,
        lon: p.location.longitude,
        geohash: p.location.geohash,
        affinity: p.query.affinity ?? 0,
        popularity: p.query.popularity ?? null,
        byType: Object.fromEntries(
          Object.entries(p.query as Record<string, unknown>).flatMap(([key, value]) => {
            const m = /^entity_(.+)_affinity$/.exec(key)
            return m && typeof value === "number" ? [[m[1] as string, value]] : []
          }),
        ),
      })),
    }
  }
  if (input.filterType === "urn:demographics") {
    const parsed = demographicsResponse.safeParse(result.body)
    const row = parsed.success ? parsed.data.results?.demographics?.[0] : undefined
    return {
      kind: "demographics",
      callId,
      age: row?.query.age ?? {},
      gender: row?.query.gender ?? {},
    }
  }
  return {
    kind: "entities",
    callId,
    picks: entitiesOf(result.body).map((e) => toPick(toTasteItem(e), loves, callId)),
  }
}

export type Area = { name: string; lat: number; lon: number; affinity: number; places: string[] }

/**
 * Names a heatmap's hottest areas the way Qloo itself would: cells are grouped by a 6-character
 * geohash (about 1 km), the strongest groups are kept, and each is named after the neighbourhood of
 * the places inside it that fit this taste best. An area whose places name no neighbourhood (or
 * only the city itself) is left out: it's never named after a hotel or a shop.
 */
export async function nameAreas(
  points: { lat: number; lon: number; geohash: string; affinity: number }[],
  signal: ExploreInput["signal"],
  loves: Love[],
  ctx: CallContext = {},
  count = 3,
  city?: string | null,
): Promise<Area[]> {
  const cityName = city?.split(",")[0]?.trim().toLowerCase()
  const groups = new Map<string, { sum: number; n: number; lat: number; lon: number }>()
  for (const p of points) {
    const key = p.geohash.slice(0, 6)
    const g = groups.get(key) ?? { sum: 0, n: 0, lat: 0, lon: 0 }
    g.sum += p.affinity
    g.n += 1
    g.lat += p.lat
    g.lon += p.lon
    groups.set(key, g)
  }
  // Mean affinity, damped for groups of one or two cells (a lone hot cell isn't a neighbourhood).
  const ranked = [...groups.entries()]
    .map(([geohash, g]) => ({
      geohash,
      score: (g.sum / g.n) * (1 - Math.exp(-g.n / 3)),
      lat: g.lat / g.n,
      lon: g.lon / g.n,
      affinity: g.sum / g.n,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count * 3)
  // Neighbouring cells often name the same place; keep the strongest of each name.
  const named = await Promise.all(
    ranked.map(async (g) => {
      const r = await explore(
        {
          filterType: "urn:entity:place",
          signal,
          // Named by where people go out there, not by its banks and churches.
          filter: { geohash: g.geohash.slice(0, 5), tags: OUTING_TAGS, excludeTags: NOT_OUTINGS },
          take: 4,
        },
        loves,
        { ...ctx, purpose: "Name an area on the map" },
      ).catch(() => null)
      const picks = r?.kind === "entities" ? r.picks : []
      const hoods = picks
        .map((p) => p.area)
        .filter((c): c is string => typeof c === "string" && c.toLowerCase() !== cityName)
      const name = hoods.sort(
        (a, b) => hoods.filter((h) => h === b).length - hoods.filter((h) => h === a).length,
      )[0]
      if (!name) return null
      return {
        name,
        lat: g.lat,
        lon: g.lon,
        affinity: g.affinity,
        places: picks.map((p) => p.name).slice(0, 3),
      }
    }),
  )
  const seen = new Set<string>()
  return named
    .filter((a): a is Area => a !== null && !seen.has(a.name) && Boolean(seen.add(a.name)))
    .slice(0, count)
}

/** Qloo's words without near-repeats ("afrobeat", "Afrobeats"; "nigeria", "nigerian"), capitalised. */
function distinctWords(tags: { name: string; affinity: number | null }[]) {
  const seen = new Set<string>()
  return tags.flatMap((t) => {
    const key = t.name.toLowerCase().replace(/(s|n)$/, "")
    if (seen.has(key)) return []
    seen.add(key)
    return [{ name: t.name.charAt(0).toUpperCase() + t.name.slice(1), affinity: t.affinity }]
  })
}

export type Scene = {
  artists: StoredPick[]
  brands: StoredPick[]
  places: StoredPick[]
  words: { name: string; affinity: number | null }[]
  callIds: string[]
}

/**
 * A neighbourhood's own taste (W12): what people around a spot on the map love — its artists,
 * brands, places and words — from a location-only signal, with no person in it.
 */
export async function sceneOf(
  point: { lat: number; lon: number; radiusMeters?: number },
  ctx: CallContext = {},
): Promise<Scene> {
  const signal = { point: { radiusMeters: 2500, ...point } }
  const ask = (filterType: string, extra: Partial<ExploreInput> = {}) =>
    explore({ filterType, signal, take: 8, withImage: filterType !== "urn:tag", ...extra }, [], {
      ...ctx,
      purpose: "The scene around a spot on the map",
    }).catch(() => null)
  const [artists, brands, places, words] = await Promise.all([
    ask("urn:entity:artist"),
    ask("urn:entity:brand"),
    ask("urn:entity:place", {
      filter: {
        point: { radiusMeters: 2500, ...point },
        tags: OUTING_TAGS,
        excludeTags: NOT_OUTINGS,
      },
    }),
    ask("urn:tag", { take: 12 }),
  ])
  const picks = (r: ExploreResult | null) => (r?.kind === "entities" ? r.picks : [])
  return {
    artists: picks(artists),
    brands: picks(brands),
    places: picks(places),
    words: words?.kind === "tags" ? distinctWords(words.tags).slice(0, 12) : [],
    callIds: [artists, brands, places, words].flatMap((r) => (r ? [r.callId] : [])),
  }
}
