import { z } from "zod"

/*
 * Response shapes from the Qloo docs (b-qloo-for-business.md §1), parsed loosely: unknown fields
 * pass through, missing ones are optional. Several shapes are UNTESTED until the first live calls
 * (affinity placement, compare output, audience items), so parsing never throws on surprises.
 */

const looseNumber = z.number().optional().catch(undefined)

export const qlooEntity = z.looseObject({
  entity_id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  subtype: z.string().optional(),
  popularity: looseNumber,
  affinity: looseNumber,
  properties: z
    .looseObject({
      image: z.looseObject({ url: z.string().optional() }).optional().catch(undefined),
      description: z.string().optional().catch(undefined),
      website: z.string().optional().catch(undefined),
      official_site: z.string().optional().catch(undefined),
      address: z.string().optional().catch(undefined),
      phone: z.string().optional().catch(undefined),
      neighborhood: z.string().optional().catch(undefined),
      business_rating: looseNumber,
      competitive_set: z.array(z.string()).optional().catch(undefined),
      complementary_brands: z.array(z.string()).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  location: z
    .looseObject({ lat: looseNumber, lon: looseNumber, geohash: z.string().optional() })
    .optional()
    .catch(undefined),
  tags: z
    .array(
      z.looseObject({
        id: z.string().optional(),
        tag_id: z.string().optional(),
        name: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional()
    .catch(undefined),
  external: z.record(z.string(), z.unknown()).optional().catch(undefined),
  query: z
    .looseObject({ affinity: looseNumber, explainability: z.unknown().optional() })
    .optional()
    .catch(undefined),
  disambiguation: z.string().optional().catch(undefined),
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
  query: z
    .looseObject({
      localities: z.looseObject({ filter: z.unknown().optional() }).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
})

export const demographicsResponse = z.looseObject({
  results: z
    .looseObject({
      demographics: z
        .array(
          z.looseObject({
            entity_id: z.string().optional(),
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
  tag_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string(),
  types: z.array(z.string()).optional().catch(undefined),
  subtype: z.string().optional().catch(undefined),
  query: z.looseObject({ affinity: looseNumber }).optional().catch(undefined),
})
export type QlooTag = z.infer<typeof qlooTag>

export const tagsResponse = z.looseObject({
  results: z
    .looseObject({ tags: z.array(qlooTag).catch([]) })
    .optional()
    .catch(undefined),
})

export const trendingPoint = z.looseObject({
  date: z.string(),
  population_percentile: looseNumber,
  population_rank: looseNumber,
  population_rank_velocity: looseNumber,
  velocity_fold_change: looseNumber,
  population_percent_delta: looseNumber,
})
export type TrendingPoint = z.infer<typeof trendingPoint>

export const trendingResponse = z.looseObject({
  results: z
    .looseObject({ trending: z.array(trendingPoint).catch([]) })
    .optional()
    .catch(undefined),
})

/** What the product shows for one taste item, whatever endpoint it came from. */
export type TasteItem = {
  entityId: string
  name: string
  type: string | null
  subtype: string | null
  image: string | null
  affinity: number | null
  popularity: number | null
  tags: string[]
  external: Record<string, unknown>
  properties: NonNullable<QlooEntity["properties"]> | Record<string, never>
}

export function toTasteItem(entity: QlooEntity): TasteItem {
  return {
    entityId: entity.entity_id,
    name: entity.name,
    type: entity.type ?? null,
    subtype: entity.subtype ?? null,
    image: entity.properties?.image?.url ?? null,
    // The docs disagree on where affinity sits; read both (first-calls #8 settles it).
    affinity: entity.query?.affinity ?? entity.affinity ?? null,
    popularity: entity.popularity ?? null,
    tags: (entity.tags ?? []).map((t) => t.name),
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
