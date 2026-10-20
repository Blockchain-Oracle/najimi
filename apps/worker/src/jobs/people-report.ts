import { TASTE_DOMAINS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { ReportItem, ReportSection } from "@najimi/db/schema"
import { namedAreas } from "@najimi/geo"
import { emit, setRunStatus } from "@najimi/live"
import {
  compare,
  demographics,
  entitiesOf,
  heatmap,
  insights,
  QlooError,
  qlooConfigured,
  type TasteItem,
  tasteTags,
  toTasteItem,
  trending,
} from "@najimi/qloo"
import { eq, sql } from "drizzle-orm"

/*
 * Your People (F3), built from Qloo section by section. The basis is the business's own Qloo
 * entity, or — when it isn't in Qloo — the comparables found for it, said plainly (R12). Sections
 * run in parallel (the client's limiter keeps Qloo calls bounded), each saved and announced as it
 * lands, so the report assembles on screen. A section that fails says so; the rest still show.
 */

const TASTE_TAKE = 12
const TAG_TAKE = 24
const TREND_DAYS = 90
const DAY_MS = 864e5

const slim = (item: TasteItem): ReportItem => ({
  entityId: item.entityId,
  name: item.name,
  subtype: item.subtype,
  image: item.image,
  affinity: item.affinity,
  popularity: item.popularity,
  tags: item.tags.slice(0, 4),
})

const reason = (error: unknown) =>
  error instanceof QlooError ? error.message : "Qloo couldn't answer this part"

export async function peopleReport(
  businessId: string,
  runId: string,
  reportId: string,
): Promise<void> {
  const [business] = await db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
  if (!business) return
  await setRunStatus(runId, "running")
  const ctx = { businessId, runId }
  const done = (key: string, label: string) => emit(runId, "section", { key, label })

  const [report] = await db
    .select()
    .from(schema.peopleReports)
    .where(eq(schema.peopleReports.id, reportId))
  if (!report) return
  const basis = report.basis.entities.map((e) => e.entityId)

  if (!qlooConfigured() || !basis.length) {
    const why = !qlooConfigured()
      ? "Qloo isn't connected yet"
      : "We couldn't find this business, or businesses like it, in Qloo"
    await db
      .update(schema.peopleReports)
      .set({ status: "unavailable", error: why })
      .where(eq(schema.peopleReports.id, reportId))
    await setRunStatus(runId, "failed", why)
    return
  }

  /** Saves one top-level section (or one domain) and announces it. */
  const save = async (
    column: "demographics" | "heatmap" | "vocabulary" | "rising" | "compare",
    value: ReportSection<unknown>,
    label: string,
  ) => {
    await db
      .update(schema.peopleReports)
      .set({ [column]: value })
      .where(eq(schema.peopleReports.id, reportId))
    await done(column, label)
  }
  const saveDomain = async (key: string, value: ReportSection<ReportItem[]>, label: string) => {
    await db
      .update(schema.peopleReports)
      .set({
        domains: sql`${schema.peopleReports.domains} || ${JSON.stringify({ [key]: value })}::jsonb`,
      })
      .where(eq(schema.peopleReports.id, reportId))
    await done(`domain:${key}`, label)
  }

  const tasks: Promise<unknown>[] = []

  // What else they love, domain by domain (F3a).
  for (const domain of TASTE_DOMAINS) {
    tasks.push(
      insights(
        {
          filterType: domain.type,
          signalEntities: basis,
          take: TASTE_TAKE,
          extra: { "filter.exclude.entities": basis },
        },
        { ...ctx, purpose: `${domain.label} your people love` },
      )
        .then((r) =>
          saveDomain(domain.key, { data: r.data.map(slim), callId: r.call.callId }, domain.label),
        )
        .catch((error) =>
          saveDomain(domain.key, { data: [], callId: null, error: reason(error) }, domain.label),
        ),
    )
  }

  // Who they are (F3b).
  tasks.push(
    demographics({ signalEntities: basis }, { ...ctx, purpose: "Who your people are" })
      .then((r) => {
        const rows = r.data
        const average = (pick: (row: (typeof rows)[number]) => Record<string, number>) => {
          const out: Record<string, number> = {}
          for (const row of rows)
            for (const [k, v] of Object.entries(pick(row))) out[k] = (out[k] ?? 0) + v / rows.length
          return out
        }
        return save(
          "demographics",
          {
            data: { age: average((x) => x.age), gender: average((x) => x.gender) },
            callId: r.call.callId,
          },
          "Age and gender",
        )
      })
      .catch((error) =>
        save(
          "demographics",
          { data: { age: {}, gender: {} }, callId: null, error: reason(error) },
          "Age and gender",
        ),
      ),
  )

  // Where they are (F3c), named neighbourhoods (R5).
  const city = report.basis.city
  if (city)
    tasks.push(
      heatmap(
        { locationQuery: city, signalEntities: basis },
        { ...ctx, purpose: `Where your people are in ${city}` },
      )
        .then(async (r) => {
          const cells = r.data.map((p) => ({
            geohash: p.location.geohash,
            lat: p.location.latitude,
            lon: p.location.longitude,
            affinity: p.query.affinity ?? 0,
            popularity: p.query.popularity ?? 0,
          }))
          const areas = await namedAreas(cells)
          return save(
            "heatmap",
            { data: { location: city, cells, areas }, callId: r.call.callId },
            "Where they are",
          )
        })
        .catch((error) =>
          save(
            "heatmap",
            { data: { location: city, cells: [], areas: [] }, callId: null, error: reason(error) },
            "Where they are",
          ),
        ),
    )

  // The words of their taste (F3a vocabulary).
  tasks.push(
    tasteTags(
      { signalEntities: basis, take: TAG_TAKE },
      { ...ctx, purpose: "The words of your people's taste" },
    )
      .then((r) =>
        save(
          "vocabulary",
          {
            data: r.data.map((t) => ({
              name: t.name,
              type: t.subtype ?? null,
              affinity: t.query?.affinity ?? null,
            })),
            callId: r.call.callId,
          },
          "Their taste in words",
        ),
      )
      .catch((error) =>
        save(
          "vocabulary",
          { data: [], callId: null, error: reason(error) },
          "Their taste in words",
        ),
      ),
  )

  // What's rising (F3d): the business's own attention, week by week.
  const own = report.basis.route === "own" ? report.basis.entities[0] : null
  const ownType =
    business.kind === "brand"
      ? "urn:entity:brand"
      : business.kind === "artist"
        ? "urn:entity:artist"
        : "urn:entity:place"
  if (own) {
    const end = new Date()
    const start = new Date(end.getTime() - TREND_DAYS * DAY_MS)
    tasks.push(
      trending(
        {
          entityId: own.entityId,
          filterType: ownType,
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        },
        { ...ctx, purpose: "How attention to you is moving" },
      )
        .then((r) =>
          save(
            "rising",
            {
              data: {
                entity: own.name,
                points: r.data
                  .map((p) => ({
                    date: p.date,
                    percentile: p.population_percentile ?? null,
                    delta: p.population_percent_delta ?? null,
                  }))
                  .reverse(),
              },
              callId: r.call.callId,
            },
            "What's moving",
          ),
        )
        .catch((error) =>
          save(
            "rising",
            { data: { entity: own.name, points: [] }, callId: null, error: reason(error) },
            "What's moving",
          ),
        ),
    )
  }

  // You vs a competitor (F3e): what their people love that yours don't (output shape untested).
  const [rival] = await db
    .select()
    .from(schema.qlooMatches)
    .where(eq(schema.qlooMatches.businessId, businessId))
    .then((rows) => rows.filter((m) => m.role === "comparable" || m.role === "competitor"))
  if (own && rival) {
    tasks.push(
      compare(
        {
          a: [own.entityId],
          b: [rival.entityId],
          filterType: "urn:entity:artist",
          take: TASTE_TAKE,
        },
        { ...ctx, purpose: `You and ${rival.name}` },
      )
        .then((r) =>
          save(
            "compare",
            {
              data: { against: rival.name, items: entitiesOf(r.data).map(toTasteItem).map(slim) },
              callId: r.call.callId,
            },
            `You and ${rival.name}`,
          ),
        )
        .catch((error) =>
          save(
            "compare",
            { data: { against: rival.name, items: [] }, callId: null, error: reason(error) },
            `You and ${rival.name}`,
          ),
        ),
    )
  }

  await Promise.allSettled(tasks)
  await db
    .update(schema.peopleReports)
    .set({ status: "ready" })
    .where(eq(schema.peopleReports.id, reportId))
  await setRunStatus(runId, "done")
}
