import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"
import { businesses, runs, timestamps } from "./core"

/** One taste item as the report shows it (slimmed from Qloo's entity). */
export type ReportItem = {
  entityId: string
  name: string
  subtype: string | null
  image: string | null
  affinity: number | null
  popularity: number | null
  tags: string[]
}

export type ReportSection<T> = { data: T; callId: string | null; error?: string }

/**
 * Your People (F3): who loves things like this business, what else they love, where they are,
 * what's rising, how they differ from a competitor's. Built section by section from Qloo; every
 * section keeps the call it came from (evidence, R1). Versioned: the newest row is the report.
 */
export const peopleReports = pgTable(
  "people_reports",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    runId: uuid().references(() => runs.id, { onDelete: "set null" }),
    status: text()
      .$type<"building" | "ready" | "failed" | "unavailable">()
      .default("building")
      .notNull(),
    /** What the report is built on: the business itself in Qloo, or businesses like it (R12). */
    basis: jsonb()
      .$type<{
        route: "own" | "comparables"
        entities: { entityId: string; name: string }[]
        city: string | null
      }>()
      .notNull(),
    domains: jsonb().$type<Record<string, ReportSection<ReportItem[]>>>().default({}).notNull(),
    demographics:
      jsonb().$type<
        ReportSection<{ age: Record<string, number>; gender: Record<string, number> }>
      >(),
    heatmap:
      jsonb().$type<
        ReportSection<{
          location: string
          cells: {
            geohash: string
            lat: number
            lon: number
            affinity: number
            popularity: number
          }[]
          areas: {
            name: string
            geohash: string
            lat: number
            lon: number
            affinity: number
            popularity: number
            cells: string[]
          }[]
        }>
      >(),
    vocabulary:
      jsonb().$type<
        ReportSection<{ name: string; type: string | null; affinity: number | null }[]>
      >(),
    rising:
      jsonb().$type<
        ReportSection<{
          entity: string
          points: { date: string; percentile: number | null; delta: number | null }[]
        }>
      >(),
    compare: jsonb().$type<ReportSection<{ against: string; items: ReportItem[] }>>(),
    error: text(),
    shareToken: text().unique(),
    ...timestamps,
  },
  (t) => [index("people_reports_business_idx").on(t.businessId, t.createdAt)],
)

export type PeopleReport = typeof peopleReports.$inferSelect
