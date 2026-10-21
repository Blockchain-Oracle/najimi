import { z } from "zod"

/*
 * Response shapes as the hackathon API really returns them (verified live 2026-10-21), parsed
 * loosely: unknown fields pass through,
 * missing ones are optional, and a surprise never throws.
 *
 * Two record sizes exist: `/search` and `/entities` return a slim record; insights results carry the
 * full one (brands ~55 properties, places ~45). `fullRecord` in api.ts fetches the full one.
 */

const looseNumber = z.number().optional().catch(undefined)
const looseString = z.string().optional().catch(undefined)
const stringList = z.array(z.string()).optional().catch(undefined)
const tagRef = z.looseObject({ id: looseString, name: z.string(), type: looseString })

export const qlooEntity = z.looseObject({
  entity_id: z.string(),
  name: z.string(),
  /** Insights items: `type: "urn:entity"` and the real kind in `subtype`. */
  type: looseString,
  subtype: looseString,
  /** `/search` items: the kind in `types[0]`. */
  types: stringList,
  popularity: looseNumber,
  affinity: looseNumber,
  properties: z
    .looseObject({
      image: z.looseObject({ url: looseString }).optional().catch(undefined),
      description: looseString,
      short_description: looseString,
      website: looseString,
      official_site: looseString,
      official_website: looseString,
      address: looseString,
      phone: looseString,
      neighborhood: looseString,
      menu_url: looseString,
      business_rating: looseNumber,
      price_level: looseNumber,
      channel: looseString,
      geocode: z
        .looseObject({
          name: looseString,
          city: looseString,
          metro: looseString,
          admin1_region: looseString,
          country_code: looseString,
          country: looseString,
        })
        .optional()
        .catch(undefined),
      primary_genre: tagRef.optional().catch(undefined),
      specialty_dishes: z.array(tagRef).optional().catch(undefined),
      // Brands (full record only).
      competitor_brands: stringList,
      similar_brands: stringList,
      known_partnerships: stringList,
      customer_segments: stringList,
    })
    .optional()
    .catch(undefined),
  location: z
    .looseObject({ lat: looseNumber, lon: looseNumber, geohash: looseString })
    .optional()
    .catch(undefined),
  tags: z
    .array(
      z.looseObject({
        id: looseString,
        tag_id: looseString,
        name: z.string(),
        type: looseString,
      }),
    )
    .optional()
    .catch(undefined),
  external: z.record(z.string(), z.unknown()).optional().catch(undefined),
  query: z
    .looseObject({
      affinity: looseNumber,
      explainability: z
        .looseObject({
          "signal.interests.entities": z
            .array(z.looseObject({ entity_id: z.string(), score: z.number() }))
            .optional()
            .catch(undefined),
        })
        .optional()
        .catch(undefined),
      /** Filled for places only: how the place's audience is growing (±) among these people. */
      measurements: z.looseObject({ audience_growth: looseNumber }).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  disambiguation: looseString,
})
export type QlooEntity = z.infer<typeof qlooEntity>

export const entitiesResponse = z.looseObject({
  results: z
    .union([z.looseObject({ entities: z.array(qlooEntity).catch([]) }), z.array(qlooEntity)])
    .optional()
    .catch(undefined),
})

export const heatmapPoint = z.looseObject({
  location: z.looseObject({ latitude: z.number(), longitude: z.number(), geohash: z.string() }),
  query: z.looseObject({
    affinity: looseNumber,
    affinity_rank: looseNumber,
    popularity: looseNumber,
  }),
})
export type HeatmapPoint = z.infer<typeof heatmapPoint>

export const heatmapResponse = z.looseObject({
  results: z
    .looseObject({ heatmap: z.array(heatmapPoint).catch([]) })
    .optional()
    .catch(undefined),
})

export const demographicsResponse = z.looseObject({
  results: z
    .looseObject({
      demographics: z
        .array(
          z.looseObject({
            entity_id: looseString,
            query: z.looseObject({
              age: z.record(z.string(), z.number()).optional().catch(undefined),
              gender: z.record(z.string(), z.number()).optional().catch(undefined),
            }),
          }),
        )
        .catch([]),
    })
    .optional()
    .catch(undefined),
})

export const qlooTag = z.looseObject({
  tag_id: looseString,
  id: looseString,
  name: z.string(),
  types: stringList,
  subtype: looseString,
  query: z.looseObject({ affinity: looseNumber }).optional().catch(undefined),
})
export type QlooTag = z.infer<typeof qlooTag>

export const tagsResponse = z.looseObject({
  results: z
    .looseObject({ tags: z.array(qlooTag).catch([]) })
    .optional()
    .catch(undefined),
})

/** One tag in a compare result; `query.score` on shared tags, `query.count` on one side's. */
const compareTag = z.looseObject({
  tag_id: looseString,
  name: z.string(),
  subtype: looseString,
  query: z.looseObject({ score: looseNumber }).optional().catch(undefined),
})
export const compareResponse = z.looseObject({
  results: z
    .looseObject({
      tags: z.array(compareTag).catch([]),
      a: z.array(compareTag).catch([]),
      b: z.array(compareTag).catch([]),
    })
    .optional()
    .catch(undefined),
})

/** Public routes to reach an entity (people, podcasts, artists): never personal data (SAFE_USE). */
export type Handles = {
  instagram: string | null
  twitter: string | null
  website: string | null
  itunes: string | null
  spotifyFollowers: number | null
}

/** What the product shows for one taste item, whatever endpoint it came from. */
export type TasteItem = {
  entityId: string
  name: string
  /** `urn:entity:artist`, `urn:entity:place`, … */
  type: string | null
  subtype: string | null
  image: string | null
  /** One short, meaningful line under the artwork (genre, neighbourhood, occupation…). */
  caption: string | null
  affinity: number | null
  popularity: number | null
  /** Places only: audience growth among these people (+ rising, − cooling). */
  growth: number | null
  /** Explainability: how much each signal entity drove this result (0–1). */
  drivers: { entityId: string; score: number }[]
  tags: string[]
  /** The tags with their ids and types (aesthetic, lifestyle… words are read from these). */
  tagRefs: { id: string; name: string; type: string }[]
  /** Tag ids, primary genre first: a signal that fetches this entity's full record. */
  tagIds: string[]
  handles: Handles
  location: { lat: number; lon: number } | null
  external: Record<string, unknown>
  properties: NonNullable<QlooEntity["properties"]> | Record<string, never>
}

/** The entity's kind, from whichever field this endpoint fills. */
export function kindOf(entity: QlooEntity): string | null {
  if (entity.subtype?.startsWith("urn:entity:")) return entity.subtype
  if (entity.types?.[0]) return entity.types[0]
  return entity.type && entity.type !== "urn:entity" ? entity.type : null
}

const GENERIC_CAPTIONS = new Set(["podcasts", "website", "mobile app", "brand", "person"])

/** The first tag of one of these types whose name says something. */
function tagOfType(entity: QlooEntity, types: string[]): string | null {
  for (const type of types)
    for (const tag of entity.tags ?? [])
      if (tag.type === type && !GENERIC_CAPTIONS.has(tag.name.toLowerCase())) return tag.name
  return null
}

/** One meaningful line per kind (live findings: the first raw tag is often noise). */
export function captionOf(entity: QlooEntity): string | null {
  const p = entity.properties
  switch (kindOf(entity)) {
    case "urn:entity:artist":
      return tagOfType(entity, ["urn:tag:genre:music", "urn:tag:subgenre:qloo"])
    case "urn:entity:movie":
    case "urn:entity:tv_show":
    case "urn:entity:videogame":
      return tagOfType(entity, ["urn:tag:genre:qloo", "urn:tag:genre:media"])
    case "urn:entity:book":
    case "urn:entity:podcast":
      return tagOfType(entity, ["urn:tag:genre:media", "urn:tag:genre:qloo"])
    case "urn:entity:person":
      return tagOfType(entity, ["urn:tag:occupation:person"])
    case "urn:entity:place":
      return p?.neighborhood ?? p?.primary_genre?.name ?? p?.geocode?.city ?? null
    case "urn:entity:destination":
      return p?.geocode?.name ?? tagOfType(entity, ["urn:tag:genre:destination"])
    case "urn:entity:brand":
      return tagOfType(entity, ["urn:tag:genre:brand", "urn:tag:brand_type:qloo"])
    default:
      return null
  }
}

const firstId = (value: unknown): string | null => {
  const first = Array.isArray(value) ? value[0] : null
  return first && typeof first === "object" && "id" in first ? String(first.id) : null
}

export function handlesOf(entity: QlooEntity): Handles {
  const ext = entity.external ?? {}
  const spotify = Array.isArray(ext.spotify) ? ext.spotify[0] : null
  const followers =
    spotify && typeof spotify === "object" && "followers" in spotify
      ? Number(spotify.followers)
      : null
  return {
    instagram: firstId(ext.instagram_username) ?? firstId(ext.instagram),
    twitter: firstId(ext.twitter_username) ?? firstId(ext.twitter),
    website:
      entity.properties?.official_website ??
      entity.properties?.website ??
      entity.properties?.official_site ??
      null,
    itunes: firstId(ext.itunes),
    spotifyFollowers: Number.isFinite(followers) ? followers : null,
  }
}

export function toTasteItem(entity: QlooEntity): TasteItem {
  const kind = kindOf(entity)
  const lat = entity.location?.lat
  const lon = entity.location?.lon
  return {
    entityId: entity.entity_id,
    name: entity.name,
    type: kind,
    subtype: kind,
    image: entity.properties?.image?.url ?? null,
    caption: captionOf(entity),
    affinity: entity.query?.affinity ?? entity.affinity ?? null,
    popularity: entity.popularity ?? null,
    growth: entity.query?.measurements?.audience_growth ?? null,
    drivers: (entity.query?.explainability?.["signal.interests.entities"] ?? []).map((d) => ({
      entityId: d.entity_id,
      score: d.score,
    })),
    tags: (entity.tags ?? []).map((t) => t.name),
    tagRefs: tagsWithTypes(entity),
    tagIds: [
      ...new Set(
        [
          entity.properties?.primary_genre?.id,
          ...(entity.tags ?? []).map((t) => t.tag_id ?? t.id),
        ].filter((id): id is string => Boolean(id)),
      ),
    ].slice(0, 5),
    handles: handlesOf(entity),
    location: lat != null && lon != null ? { lat, lon } : null,
    external: entity.external ?? {},
    properties: entity.properties ?? {},
  }
}

/** `results.entities[]` or a bare `results[]`, whichever the endpoint returned. */
export function entitiesOf(body: unknown): QlooEntity[] {
  const parsed = entitiesResponse.safeParse(body)
  const results = parsed.success ? parsed.data.results : undefined
  if (!results) return []
  return Array.isArray(results) ? results : results.entities
}

/** The tags a tag-weighted vocabulary is built from: each item's tags with its type. */
export function tagsWithTypes(entity: QlooEntity): { id: string; name: string; type: string }[] {
  return (entity.tags ?? []).flatMap((t) => {
    const id = t.tag_id ?? t.id
    return id && t.type ? [{ id, name: t.name, type: t.type }] : []
  })
}
