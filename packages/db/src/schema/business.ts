import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { runs } from "./core"

/** Something Qloo knows, as a plan shows it (with the call it came from, as evidence). */
export type BusinessThing = {
  qlooId: string
  name: string
  type: string
  image: string | null
  caption: string | null
  /** How strongly it fits (Qloo's affinity, 0–1). */
  fit: number | null
  callId: string | null
}

/** One idea in the plan, with the Qloo results behind it. */
export type BusinessIdea = {
  kind: "menu" | "music" | "night" | "stock" | "partner" | "space" | "service"
  title: string
  why: string
  /** Qloo ids from the evidence it rests on. */
  evidence: string[]
}

/**
 * A business plan (W19), built from Qloo: who the fans are and what else they love, where they
 * cluster, the street's own scene against the business's, what's rising nearby, and the plan.
 * Every list keeps the Qloo call it came from.
 */
export type BusinessReport = {
  /** What the site says (offer, vibe), read by the light model; null without a site. */
  site: { title: string | null; offer: string[]; vibe: string[] } | null
  /** The business's own Qloo entity, or null when it's matched through comparables. */
  match: BusinessThing | null
  comparables: BusinessThing[]
  /** What the fans love, by kind (artist, movie, tv_show, book, podcast, brand, place…). */
  fans: Record<string, BusinessThing[]>
  /** The fans' words (Qloo tags), strongest first. */
  words: { name: string; score: number | null }[]
  /** Age and gender lean (+ above average, − below). */
  lean: { age: Record<string, number>; gender: Record<string, number> } | null
  /** Where the fans cluster in the city: named areas and the raw cells for the map. */
  areas: { name: string; lat: number; lon: number; affinity: number }[]
  cells: [string, number][]
  /** The street's own scene (a location-only signal) and how it compares. */
  scene: {
    area: string | null
    words: string[]
    artists: BusinessThing[]
    brands: BusinessThing[]
    places: BusinessThing[]
  } | null
  compare: { shared: string[]; theirsOnly: string[]; sceneOnly: string[] } | null
  /** Places near it whose audience is growing among the fans (Qloo's audience_growth). */
  rising: (BusinessThing & { growth: number })[]
  plan: {
    summary: string
    ideas: BusinessIdea[]
    partners: { qlooId: string; why: string }[]
    posts: string[]
    targets: { area: string; why: string }[]
  } | null
  /** Every Qloo call the plan stands on. */
  calls: string[]
  builtAt: string
}

export const businesses = pgTable(
  "businesses",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    name: text().notNull(),
    /** What it is, in the owner's words ("café", "barbershop", "electrician"). */
    kind: text().notNull(),
    city: text(),
    address: text(),
    lat: doublePrecision(),
    lon: doublePrecision(),
    links: jsonb()
      .$type<{ site?: string | null; instagram?: string | null; menu?: string | null }>()
      .default({})
      .notNull(),
    /** Who the owner thinks the customers are, and the decision they're weighing. */
    audienceGuess: text(),
    decision: text(),
    status: text().$type<"building" | "ready" | "failed">().notNull().default("building"),
    runId: uuid().references(() => runs.id, { onDelete: "set null" }),
    report: jsonb().$type<BusinessReport>(),
    error: text(),
    /** The public plan page (/b/<token>); null when not shared. */
    shareToken: text(),
    /** The last weekly check. */
    checkedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("businesses_owner_idx").on(t.ownerId),
    uniqueIndex("businesses_share_idx").on(t.shareToken),
  ],
)
