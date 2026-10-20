import { QLOO } from "@najimi/config"
import { type CallContext, type CallResult, qlooCall } from "./call"
import type { Params } from "./client"
import {
  demographicsResponse,
  entitiesOf,
  type HeatmapPoint,
  heatmapResponse,
  type QlooTag,
  type TasteItem,
  type TrendingPoint,
  tagsResponse,
  toTasteItem,
  trendingResponse,
} from "./types"

/*
 * The Qloo endpoints the product uses (plan §3), each returning parsed data plus the call id that
 * evidence chips point to. All GET on the hackathon host.
 */

type With<T> = { data: T; call: Pick<CallResult, "callId" | "status" | "cacheHit"> }
const meta = (r: CallResult) => ({ callId: r.callId, status: r.status, cacheHit: r.cacheHit })

/** `/search`: is this business (or a comparable) in Qloo? A 404 means "no results". */
export async function search(
  input: {
    query: string
    types?: string[]
    location?: { lat: number; lon: number }
    radiusMiles?: number
    address?: string
    take?: number
    sortBy?: "match" | "distance" | "popularity"
  },
  ctx?: CallContext,
): Promise<With<TasteItem[]>> {
  const params: Params = {
    query: input.query,
    types: input.types,
    "filter.location": input.location ? `${input.location.lat},${input.location.lon}` : undefined,
    "filter.radius": input.location ? (input.radiusMiles ?? 1) : undefined,
    "filter.address": input.address,
    sort_by: input.sortBy,
    take: input.take ?? 5,
  }
  const result = await qlooCall("/search", params, ctx)
  const items = result.status === 404 ? [] : entitiesOf(result.body).map(toTasteItem)
  return { data: items, call: meta(result) }
}

/** `/entities`: by Qloo ids, or by one external id (instagram, twitter, wikidata, …). */
export async function entities(
  input: { ids: string[] } | { external: string; ids: string[] },
  ctx?: CallContext,
): Promise<With<TasteItem[]>> {
  const params: Params =
    "external" in input
      ? { [`external.${input.external}.ids`]: input.ids }
      : { entity_ids: input.ids }
  const result = await qlooCall("/entities", params, ctx)
  return { data: entitiesOf(result.body).map(toTasteItem), call: meta(result) }
}

export type InsightsInput = {
  filterType: string
  signalEntities?: string[]
  signalTags?: string[]
  extra?: Params
  take?: number
}

/** `/v2/insights` for entity types: what your people also love in one domain. */
export async function insights(
  input: InsightsInput,
  ctx?: CallContext,
): Promise<With<TasteItem[]>> {
  const result = await qlooCall(
    "/v2/insights",
    {
      "filter.type": input.filterType,
      "signal.interests.entities": input.signalEntities,
      "signal.interests.tags": input.signalTags,
      take: Math.min(input.take ?? 20, QLOO.takeMax),
      "feature.explainability": true,
      ...input.extra,
    },
    ctx,
  )
  return { data: entitiesOf(result.body).map(toTasteItem), call: meta(result) }
}

/** `urn:heatmap`: where your people are in a city, cell by cell (geohash, affinity, popularity). */
export async function heatmap(
  input: {
    locationQuery: string
    signalEntities?: string[]
    signalTags?: string[]
    extra?: Params
  },
  ctx?: CallContext,
): Promise<With<HeatmapPoint[]>> {
  const result = await qlooCall(
    "/v2/insights",
    {
      "filter.type": "urn:heatmap",
      "filter.location.query": input.locationQuery,
      "signal.interests.entities": input.signalEntities,
      "signal.interests.tags": input.signalTags,
      ...input.extra,
    },
    ctx,
  )
  const parsed = heatmapResponse.safeParse(result.body)
  return { data: parsed.success ? (parsed.data.results?.heatmap ?? []) : [], call: meta(result) }
}

export type DemographicLean = {
  entityId: string | null
  age: Record<string, number>
  gender: Record<string, number>
}

/** `urn:demographics`: age and gender lean (positive = above average, negative = below). */
export async function demographics(
  input: { signalEntities?: string[]; signalTags?: string[] },
  ctx?: CallContext,
): Promise<With<DemographicLean[]>> {
  const result = await qlooCall(
    "/v2/insights",
    {
      "filter.type": "urn:demographics",
      "signal.interests.entities": input.signalEntities,
      "signal.interests.tags": input.signalTags,
    },
    ctx,
  )
  const parsed = demographicsResponse.safeParse(result.body)
  const rows = parsed.success ? (parsed.data.results?.demographics ?? []) : []
  return {
    data: rows.map((r) => ({
      entityId: r.entity_id ?? null,
      age: r.query.age ?? {},
      gender: r.query.gender ?? {},
    })),
    call: meta(result),
  }
}

/** `urn:tag`: the vocabulary of your people's taste (styles, cuisines, keywords). */
export async function tasteTags(
  input: { signalEntities: string[]; tagTypes?: string[]; parentTypes?: string[]; take?: number },
  ctx?: CallContext,
): Promise<With<QlooTag[]>> {
  const result = await qlooCall(
    "/v2/insights",
    {
      "filter.type": "urn:tag",
      "signal.interests.entities": input.signalEntities,
      "filter.tag.types": input.tagTypes,
      "filter.parents.types": input.parentTypes,
      take: Math.min(input.take ?? 20, QLOO.takeMax),
    },
    ctx,
  )
  const parsed = tagsResponse.safeParse(result.body)
  return { data: parsed.success ? (parsed.data.results?.tags ?? []) : [], call: meta(result) }
}

/** `/v2/tags`: find tag ids by meaning (semantic search is beta). */
export async function findTags(
  input: { query: string; tagTypes?: string[]; semantic?: boolean; take?: number },
  ctx?: CallContext,
): Promise<With<QlooTag[]>> {
  const result = await qlooCall(
    "/v2/tags",
    {
      "filter.query": input.query,
      "feature.semantic_search": input.semantic ?? true,
      "filter.tag.types": input.tagTypes,
      take: Math.min(input.take ?? 20, QLOO.takeMax),
    },
    ctx,
  )
  const parsed = tagsResponse.safeParse(result.body)
  return { data: parsed.success ? (parsed.data.results?.tags ?? []) : [], call: meta(result) }
}

/** `/v2/trending`: one entity's weekly attention over a date range (newest first). */
export async function trending(
  input: { entityId: string; filterType: string; start: string; end: string },
  ctx?: CallContext,
): Promise<With<TrendingPoint[]>> {
  const result = await qlooCall(
    "/v2/trending",
    {
      "signal.interests.entities": [input.entityId],
      "filter.type": input.filterType,
      "filter.start_date": input.start,
      "filter.end_date": input.end,
    },
    ctx,
  )
  const parsed = trendingResponse.safeParse(result.body)
  return { data: parsed.success ? (parsed.data.results?.trending ?? []) : [], call: meta(result) }
}

/** `/v2/analysis/compare`: two groups of entities side by side (output shape UNTESTED). */
export async function compare(
  input: { a: string[]; b: string[]; filterType?: string; take?: number },
  ctx?: CallContext,
): Promise<With<unknown>> {
  const result = await qlooCall(
    "/v2/analysis/compare",
    {
      "a.signal.interests.entities": input.a,
      "b.signal.interests.entities": input.b,
      "filter.type": input.filterType,
      take: input.take,
    },
    ctx,
  )
  return { data: result.body, call: meta(result) }
}

/** `/v2/audiences/types` and `/v2/audiences`: audience ids for ad descriptions (item shape UNTESTED). */
export async function audienceTypes(ctx?: CallContext): Promise<With<unknown>> {
  const result = await qlooCall("/v2/audiences/types", {}, ctx)
  return { data: result.body, call: meta(result) }
}

export async function audiences(
  input: { parentTypes?: string[]; query?: string; take?: number },
  ctx?: CallContext,
): Promise<With<unknown>> {
  const result = await qlooCall(
    "/v2/audiences",
    {
      "filter.parents.types": input.parentTypes,
      "filter.query": input.query,
      take: Math.min(input.take ?? 20, QLOO.takeMax),
    },
    ctx,
  )
  return { data: result.body, call: meta(result) }
}
