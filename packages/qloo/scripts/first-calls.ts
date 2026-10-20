/**
 * Day-one checks against the hackathon host (plan §3, "first calls"). Settles what the docs leave
 * open: hit rates, external-id lookups, where affinity sits, which types and location parameters
 * the host accepts, heatmap/trending/compare/audience shapes, paging. Fresh calls (no cache).
 *
 *   pnpm --filter @najimi/qloo first-calls
 *
 * Writes a findings summary (statuses, counts, field presence — never response bodies, which must
 * not be published) to context/01-qloo-api/first-calls-<date>.md, which git ignores.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { normalizeParams, type Params, qlooFetch } from "../src/client"
import { entitiesOf } from "../src/types"

type Check = {
  id: string
  title: string
  path: string
  params: Params
  /** Notes about the response worth recording (field presence, counts), never the data itself. */
  inspect?: (body: unknown) => string[]
}

const has = (value: unknown) => value !== undefined && value !== null && value !== ""

function entityNotes(body: unknown): string[] {
  const list = entitiesOf(body)
  if (!list.length) return ["0 entities"]
  const share = (pick: (e: (typeof list)[number]) => unknown) =>
    `${list.filter((e) => has(pick(e))).length}/${list.length}`
  return [
    `${list.length} entities`,
    `image ${share((e) => e.properties?.image?.url)}`,
    `website ${share((e) => e.properties?.website ?? e.properties?.official_site)}`,
    `external.instagram ${share((e) => (e.external as Record<string, unknown> | undefined)?.instagram)}`,
    `query.affinity ${share((e) => e.query?.affinity)} · top-level affinity ${share((e) => e.affinity)}`,
    `explainability ${share((e) => e.query?.explainability)}`,
    `competitive_set ${share((e) => e.properties?.competitive_set)}`,
    `first: ${list[0]?.name ?? "?"} (${list[0]?.type ?? "?"})`,
  ]
}

const keysOf = (body: unknown, path: string[]): string[] => {
  let node: unknown = body
  for (const key of path) node = (node as Record<string, unknown> | undefined)?.[key]
  if (Array.isArray(node))
    return [`${node.length} items`, `item keys: ${Object.keys(node[0] ?? {}).join(", ")}`]
  return node && typeof node === "object" ? [`keys: ${Object.keys(node).join(", ")}`] : ["absent"]
}

const PLACE = "Balthazar"
const NYC = "40.7224,-73.9981"
const today = new Date().toISOString().slice(0, 10)
const ninetyDaysAgo = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)

const checks: Check[] = [
  {
    id: "1",
    title: "Auth + host: search a known restaurant",
    path: "/search",
    params: { query: PLACE, types: "urn:entity:place", take: 5 },
    inspect: entityNotes,
  },
  {
    id: "3a",
    title: "Hit rate: a chain brand",
    path: "/search",
    params: { query: "Nike", types: "urn:entity:brand", take: 3 },
    inspect: entityNotes,
  },
  {
    id: "3b",
    title: "Hit rate: a DTC brand",
    path: "/search",
    params: { query: "Glossier", types: "urn:entity:brand", take: 3 },
    inspect: entityNotes,
  },
  {
    id: "3c",
    title: "Hit rate: a place near a point",
    path: "/search",
    params: {
      query: PLACE,
      types: "urn:entity:place",
      "filter.location": NYC,
      "filter.radius": 1,
      sort_by: "distance",
      take: 3,
    },
    inspect: entityNotes,
  },
  {
    id: "3d",
    title: "Hit rate: a São Paulo restaurant",
    path: "/search",
    params: { query: "D.O.M.", types: "urn:entity:place", "filter.address": "São Paulo", take: 3 },
    inspect: entityNotes,
  },
  {
    id: "3e",
    title: "Hit rate: a Lagos restaurant",
    path: "/search",
    params: {
      query: "Nok by Alara",
      types: "urn:entity:place",
      "filter.address": "Lagos",
      take: 3,
    },
    inspect: entityNotes,
  },
  {
    id: "3f",
    title: "Hit rate: a museum",
    path: "/search",
    params: { query: "MoMA", types: "urn:entity:place", take: 3 },
    inspect: entityNotes,
  },
  {
    id: "3g",
    title: "Hit rate: an artist",
    path: "/search",
    params: { query: "Burna Boy", types: "urn:entity:artist", take: 3 },
    inspect: entityNotes,
  },
  {
    id: "4a",
    title: "External id: Instagram bare handle",
    path: "/entities",
    params: { "external.instagram.ids": "nike" },
    inspect: entityNotes,
  },
  {
    id: "4b",
    title: "External id: Wikidata",
    path: "/entities",
    params: { "external.wikidata.ids": "Q483915" },
    inspect: entityNotes,
  },
  {
    id: "6a",
    title: "Location: brand insights, no location",
    path: "/v2/insights",
    params: { "filter.type": "urn:entity:brand", "filter.entities.query": "Nike", take: 5 },
    inspect: entityNotes,
  },
  {
    id: "6b",
    title: "Location: artist insights with signal.location.query",
    path: "/v2/insights",
    params: { "filter.type": "urn:entity:artist", "signal.location.query": "London", take: 5 },
    inspect: entityNotes,
  },
  {
    id: "6c",
    title: "Location: place insights with filter.location.query",
    path: "/v2/insights",
    params: { "filter.type": "urn:entity:place", "filter.location.query": "London", take: 5 },
    inspect: entityNotes,
  },
  {
    id: "7a",
    title: "Type: video_game",
    path: "/v2/insights",
    params: { "filter.type": "urn:entity:video_game", "signal.location.query": "London", take: 3 },
    inspect: entityNotes,
  },
  {
    id: "7b",
    title: "Type: videogame",
    path: "/v2/insights",
    params: { "filter.type": "urn:entity:videogame", "signal.location.query": "London", take: 3 },
    inspect: entityNotes,
  },
  {
    id: "7c",
    title: "Type: destination (needs a signal)",
    path: "/v2/insights",
    params: {
      "filter.type": "urn:entity:destination",
      "filter.entities.query": "Balthazar",
      take: 3,
    },
    inspect: entityNotes,
  },
  {
    id: "10",
    title: "Heatmap: a tag over NYC",
    path: "/v2/insights",
    params: {
      "filter.type": "urn:heatmap",
      "filter.location.query": "New York City",
      "signal.interests.tags": "urn:tag:genre:place:restaurant:french",
    },
    inspect: (b) => keysOf(b, ["results", "heatmap"]),
  },
  {
    id: "11a",
    title: "Tags: semantic search",
    path: "/v2/tags",
    params: { "filter.query": "natural wine bar", "feature.semantic_search": true, take: 5 },
    inspect: (b) => keysOf(b, ["results", "tags"]),
  },
  {
    id: "11b",
    title: "Tag types",
    path: "/v2/tags/types",
    params: {},
    inspect: (b) => keysOf(b, ["results"]),
  },
  {
    id: "14a",
    title: "Audience types",
    path: "/v2/audiences/types",
    params: {},
    inspect: (b) => keysOf(b, ["results"]),
  },
  {
    id: "14b",
    title: "Audiences under hobbies",
    path: "/v2/audiences",
    params: { "filter.parents.types": "urn:audience:hobbies_and_interests", take: 5 },
    inspect: (b) => keysOf(b, ["results"]),
  },
  {
    id: "17",
    title: "Paging: take=51 on insights",
    path: "/v2/insights",
    params: { "filter.type": "urn:entity:artist", "signal.location.query": "London", take: 51 },
    inspect: entityNotes,
  },
]

/** Checks that need an id found by an earlier check (Balthazar's entity id). */
function dependentChecks(placeId: string, brandId: string | undefined): Check[] {
  return [
    {
      id: "8",
      title: "Insights from one place: where affinity sits, explainability",
      path: "/v2/insights",
      params: {
        "filter.type": "urn:entity:artist",
        "signal.interests.entities": placeId,
        "feature.explainability": true,
        take: 5,
      },
      inspect: entityNotes,
    },
    {
      id: "9",
      title: "Demographics for one place",
      path: "/v2/insights",
      params: { "filter.type": "urn:demographics", "signal.interests.entities": placeId },
      inspect: (b) => keysOf(b, ["results", "demographics"]),
    },
    {
      id: "10b",
      title: "Heatmap for one place's audience",
      path: "/v2/insights",
      params: {
        "filter.type": "urn:heatmap",
        "filter.location.query": "New York City",
        "signal.interests.entities": placeId,
      },
      inspect: (b) => keysOf(b, ["results", "heatmap"]),
    },
    {
      id: "11c",
      title: "Taste analysis (urn:tag) for one place",
      path: "/v2/insights",
      params: { "filter.type": "urn:tag", "signal.interests.entities": placeId, take: 10 },
      inspect: (b) => keysOf(b, ["results", "tags"]),
    },
    {
      id: "12",
      title: "Trending for one place, 90 days",
      path: "/v2/trending",
      params: {
        "signal.interests.entities": placeId,
        "filter.type": "urn:entity:place",
        "filter.start_date": ninetyDaysAgo,
        "filter.end_date": today,
      },
      inspect: (b) => keysOf(b, ["results", "trending"]),
    },
    {
      id: "13",
      title: "Compare a place's audience with a brand's",
      path: "/v2/analysis/compare",
      params: {
        "a.signal.interests.entities": placeId,
        "b.signal.interests.entities": brandId ?? placeId,
        "filter.type": "urn:entity:artist",
        take: 5,
      },
      inspect: (b) => keysOf(b, ["results"]),
    },
    {
      id: "16",
      title: "Rank a shortlist with filter.results.entities",
      path: "/v2/insights",
      params: {
        "filter.type": "urn:entity:place",
        "signal.interests.entities": placeId,
        "filter.results.entities": placeId,
        take: 3,
      },
      inspect: entityNotes,
    },
  ]
}

async function run(check: Check) {
  const params = normalizeParams(check.params)
  try {
    const r = await qlooFetch(check.path, params)
    const notes = check.inspect?.(r.body) ?? []
    return {
      check,
      status: r.status,
      ms: r.ms,
      bytes: r.bytes,
      headers: r.headers,
      notes,
      body: r.body,
    }
  } catch (error) {
    return {
      check,
      status: null,
      ms: null,
      bytes: null,
      headers: {},
      notes: [String(error)],
      body: null,
    }
  }
}

async function main() {
  const results = []
  for (const check of checks) {
    const result = await run(check)
    results.push(result)
    console.log(
      `#${check.id} ${result.status ?? "ERR"} ${check.title} — ${result.notes.join(" · ")}`,
    )
  }
  const placeId = entitiesOf(results[0]?.body)[0]?.entity_id
  const brandId = entitiesOf(results.find((r) => r.check.id === "3a")?.body)[0]?.entity_id
  if (placeId) {
    for (const check of dependentChecks(placeId, brandId)) {
      const result = await run(check)
      results.push(result)
      console.log(
        `#${check.id} ${result.status ?? "ERR"} ${check.title} — ${result.notes.join(" · ")}`,
      )
    }
  } else {
    console.log("No place id from check #1: the dependent checks (8–16) were skipped.")
  }

  const lines = [
    `# Qloo first calls — ${new Date().toISOString()}`,
    "",
    "Fresh calls to https://hackathon.api.qloo.com (no cache). Statuses, timings, sizes and field presence only; no response data is stored here.",
    "",
    "| # | Check | Status | ms | Bytes | Notes |",
    "|---|---|---|---|---|---|",
    ...results.map(
      (r) =>
        `| ${r.check.id} | ${r.check.title} | ${r.status ?? "error"} | ${r.ms ?? ""} | ${r.bytes ?? ""} | ${r.notes.join(" · ").replaceAll("|", "/")} |`,
    ),
    "",
    "## Headers seen",
    "",
    ...[...new Set(results.flatMap((r) => Object.keys(r.headers)))].map((h) => `- \`${h}\``),
    "",
  ]
  const dir = new URL("../../../context/01-qloo-api/", import.meta.url)
  mkdirSync(dir, { recursive: true })
  const file = new URL(`first-calls-${today}.md`, dir)
  writeFileSync(file, lines.join("\n"))
  console.log(`\nFindings written to ${file.pathname} (git-ignored).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
