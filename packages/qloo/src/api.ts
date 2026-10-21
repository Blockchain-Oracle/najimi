import { QLOO } from "@najimi/config"
import { type CallContext, type CallResult, qlooCall } from "./call"
import type { Params } from "./client"
import {
  compareResponse,
  demographicsResponse,
  entitiesOf,
  type QlooTag,
  type TasteItem,
  tagsResponse,
  toTasteItem,
} from "./types"

/*
 * The Qloo endpoints the product uses, each returning parsed data plus the call id evidence chips
 * point to. Every parameter here was checked against the live hackathon API on 2026-10-21.
 */

type Call = Pick<CallResult, "callId" | "status" | "cacheHit">
type With<T> = { data: T; call: Call }
const meta = (r: CallResult): Call => ({ callId: r.callId, status: r.status, cacheHit: r.cacheHit })
const take = (n: number | undefined, fallback: number) => Math.min(n ?? fallback, QLOO.takeMax)

/** `/search`: entities by name. A 404 means "no results". Search has no address filter. */
export async function search(
  input: {
    query: string
    types?: string[]
    near?: { lat: number; lon: number }
    radiusMiles?: number
    take?: number
    sortBy?: "match" | "distance" | "popularity"
  },
  ctx?: CallContext,
): Promise<With<TasteItem[]>> {
  const params: Params = {
    query: input.query,
    types: input.types,
    "filter.location": input.near ? `${input.near.lat},${input.near.lon}` : undefined,
    "filter.radius": input.near ? (input.radiusMiles ?? 1) : undefined,
    sort_by: input.sortBy,
    take: input.take ?? 5,
  }
  const result = await qlooCall("/search", params, ctx)
  const items = result.status === 404 ? [] : entitiesOf(result.body).map(toTasteItem)
  return { data: items, call: meta(result) }
}

/** A named city or neighbourhood (a Qloo locality) and its centre point. */
export async function locality(
  query: string,
  ctx?: CallContext,
): Promise<{ entityId: string; name: string; lat: number; lon: number } | null> {
  const r = await search({ query, types: ["urn:entity:locality"], take: 1 }, ctx)
  const hit = r.data[0]
  return hit?.location ? { entityId: hit.entityId, name: hit.name, ...hit.location } : null
}

/** `/entities`: by Qloo ids, or by one external id (instagram, twitter, spotify, resy, wikidata). */
export async function entities(
  input: { ids: string[] } | { external: string; ids: string[] },
  ctx?: CallContext,
): Promise<With<TasteItem[]>> {
  const params: Params =
    "external" in input
      ? {
          // Qloo stores Wikidata ids lowercased; "Q123" finds nothing, "q123" does.
          [`external.${input.external}.ids`]:
            input.external === "wikidata" ? input.ids.map((id) => id.toLowerCase()) : input.ids,
        }
      : { entity_ids: input.ids }
  const result = await qlooCall("/entities", params, ctx)
  return { data: entitiesOf(result.body).map(toTasteItem), call: meta(result) }
}

/**
 * An entity's full record (~45 properties for a place: selling points, who its customers are,
 * ambience, signature dishes, hours; ~55 for a brand: competitors, partnerships). `/search` and
 * `/entities` return a slim record; insights results carry the full one, so the entity is scored
 * against one of its own tags.
 */
export async function fullRecord(
  item: Pick<TasteItem, "entityId" | "type" | "tagIds">,
  ctx?: CallContext,
): Promise<With<TasteItem | null>> {
  const tag = item.tagIds[0]
  if (!tag || !item.type) return { data: null, call: { callId: "", status: 0, cacheHit: false } }
  const result = await qlooCall(
    "/v2/insights",
    {
      "filter.type": item.type,
      "signal.interests.tags": tag,
      "filter.results.entities": item.entityId,
    },
    ctx,
  )
  const [entity] = entitiesOf(result.body)
  return { data: entity ? toTasteItem(entity) : null, call: meta(result) }
}

export type InsightsInput = {
  filterType: string
  signalEntities?: string[]
  signalTags?: string[]
  /** Only entities with artwork (rows that must show images). */
  withImage?: boolean
  extra?: Params
  take?: number
}

/** `/v2/insights` for entity types, with explainability (whose signal drove each result). */
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
      "filter.exists": input.withImage ? "properties.image" : undefined,
      take: take(input.take, 20),
      "feature.explainability": true,
      ...input.extra,
    },
    ctx,
  )
  return { data: entitiesOf(result.body).map(toTasteItem), call: meta(result) }
}

type Signal = { signalEntities?: string[]; signalTags?: string[] }

/** How well each of these entities fits this signal (affinity per id). */
export function scoreShortlist(
  input: Signal & { filterType: string; ids: string[] },
  ctx?: CallContext,
) {
  return insights(
    { ...input, extra: { "filter.results.entities": input.ids }, take: input.ids.length },
    ctx,
  )
}

export type DemographicLean = {
  entityId: string | null
  age: Record<string, number>
  gender: Record<string, number>
}

/** `urn:demographics`: age and gender lean (positive = above average, negative = below). */
export async function demographics(
  input: Signal,
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

/** `urn:tag`: the words of a place's taste (for a place signal: its own domain's tags). */
export async function tasteTags(
  input: { signalEntities: string[]; take?: number },
  ctx?: CallContext,
): Promise<With<QlooTag[]>> {
  const result = await qlooCall(
    "/v2/insights",
    {
      "filter.type": "urn:tag",
      "signal.interests.entities": input.signalEntities,
      take: take(input.take, 20),
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
      take: take(input.take, 20),
    },
    ctx,
  )
  const parsed = tagsResponse.safeParse(result.body)
  return { data: parsed.success ? (parsed.data.results?.tags ?? []) : [], call: meta(result) }
}

export type CompareResult = {
  shared: { name: string; score: number | null }[]
  onlyA: string[]
  onlyB: string[]
}

/** `/v2/analysis/compare`: two groups' tags — shared (scored), and each side's own. */
export async function compare(
  input: { a: string[]; b: string[] },
  ctx?: CallContext,
): Promise<With<CompareResult>> {
  const result = await qlooCall(
    "/v2/analysis/compare",
    { "a.signal.interests.entities": input.a, "b.signal.interests.entities": input.b },
    ctx,
  )
  const parsed = compareResponse.safeParse(result.body)
  const r = parsed.success ? parsed.data.results : undefined
  const sharedNames = new Set((r?.tags ?? []).map((t) => t.name))
  return {
    data: {
      shared: (r?.tags ?? []).map((t) => ({ name: t.name, score: t.query?.score ?? null })),
      onlyA: (r?.a ?? []).map((t) => t.name).filter((n) => !sharedNames.has(n)),
      onlyB: (r?.b ?? []).map((t) => t.name).filter((n) => !sharedNames.has(n)),
    },
    call: meta(result),
  }
}

/** `/v2/audiences`: named audiences (e.g. life stage "Single") for audience signals. */
export async function audiences(
  input: { parentTypes?: string[]; take?: number },
  ctx?: CallContext,
): Promise<With<{ id: string; name: string }[]>> {
  const result = await qlooCall(
    "/v2/audiences",
    { "filter.parents.types": input.parentTypes, take: take(input.take, 20) },
    ctx,
  )
  const body = result.body as { results?: { audiences?: { entity_id?: string; name?: string }[] } }
  const rows = (body.results?.audiences ?? []).flatMap((a) =>
    a.entity_id && a.name ? [{ id: a.entity_id, name: a.name }] : [],
  )
  return { data: rows, call: meta(result) }
}
