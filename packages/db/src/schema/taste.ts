import { sql } from "drizzle-orm"
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { owner, runs, timestamps } from "./core"

/** The words a taste is made of, from Qloo tags: what every creation's prompt is built from. */
export type TasteWords = {
  aesthetic: string[]
  lifestyle: string[]
  style: string[]
  decor: string[]
  ambience: string[]
  cuisine: string[]
  dishes: string[]
}

/** An area where a taste lives in a city (from Qloo's heatmap), named by the places inside it. */
export type TasteArea = {
  name: string
  lat: number
  lon: number
  affinity: number
  places: string[]
}

/** One pick as stored on the taste page: always from Qloo, with the love that drove it. */
export type StoredPick = {
  qlooId: string
  type: string
  name: string
  image: string | null
  caption: string | null
  affinity: number | null
  /** The love with the top explainability share (the "because" chip). */
  because: { qlooId: string; name: string; share: number | null } | null
  /** Every love's share of this pick (explainability), for re-ranking when a weight moves. */
  shares?: { id: string; share: number }[]
  callId: string
  links?: Record<string, string>
  /** Places: the neighbourhood (or town) it's in. */
  area?: string | null
  /** Places: what Qloo says they're known for (cuisines, specialty dishes). */
  details?: string[]
  /** Ids elsewhere, for media (Apple previews via Wikidata, trailers via IMDb, podcast feeds). */
  ids?: {
    wikidata?: string
    imdb?: string
    itunes?: string
    spotify?: string
    musicbrainz?: string
    isbn13?: string
  }
}

export const userPrefs = pgTable("user_prefs", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  locale: text(),
  /** Ask before making (default), make automatically, or plan only (rule 6). */
  mode: text().$type<"ask" | "auto" | "plan">().default("ask").notNull(),
  onboardedAt: timestamp({ withTimezone: true }),
  ...timestamps,
})

/** A person's own taste profile (one per user, `isSelf`): who they are and where. */
export const people = pgTable(
  "people",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    isSelf: boolean().default(false).notNull(),
    name: text().notNull(),
    city: text(),
    cityLat: doublePrecision(),
    cityLon: doublePrecision(),
    /** The face picked at sign-up (config LOOKS): it sets the identity colour. */
    look: text(),
    locale: text(),
    /** A line about themselves, shown on their profile. */
    bio: text(),
    /** Who sees their taste and finds them: everyone, friends, or only them. */
    visibility: text().$type<"public" | "friends" | "private">().default("public").notNull(),
    /** Their taste colours, from their loves' artwork (orb, aura, washes). */
    aura: jsonb().$type<{ c1: string; c2: string; c3: string }>(),
    /** Qloo ids marked "not for me": excluded from every later pick. */
    excludedIds: text().array().default(sql`'{}'::text[]`).notNull(),
    /** How much of each category the feed shows (0 off … 3 more); null = the defaults. */
    feedMix: jsonb().$type<Record<string, number>>(),
    /** Where their feed got to, so it carries on with something new (reset when the taste moves). */
    feedCursor: jsonb().$type<{ key: string; cursor: string }>(),
    ...timestamps,
  },
  (t) => [
    index("people_owner_idx").on(t.ownerId, t.createdAt),
    uniqueIndex("people_one_self_idx").on(t.ownerId).where(sql`${t.isSelf}`),
  ],
)

/** A thing someone loves (a Qloo entity), with how much it counts in their taste. */
export const loves = pgTable(
  "loves",
  {
    id: uuid().defaultRandom().primaryKey(),
    personId: uuid()
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    qlooId: text().notNull(),
    type: text().notNull(),
    name: text().notNull(),
    imageUrl: text(),
    weight: integer().default(5).notNull(),
    /** Where it came from: picked or imported by them, or loved in the feed (only these make room). */
    source: text().$type<"pick" | "feed">().default("pick").notNull(),
    /** Domains this love returned nothing (or a 400) for; left out of those calls. */
    sparseDomains: text().array().default(sql`'{}'::text[]`).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("loves_person_entity_idx").on(t.personId, t.qlooId)],
)

/** A person's computed taste: recomputed whenever their loves change (job `taste.refresh`). */
export const tastes = pgTable("tastes", {
  personId: uuid()
    .primaryKey()
    .references(() => people.id, { onDelete: "cascade" }),
  version: integer().default(0).notNull(),
  /** The loves (ids and weights) this was computed from; a mismatch means it's stale. */
  lovesKey: text(),
  words: jsonb().$type<TasteWords>(),
  picks: jsonb().$type<Record<string, StoredPick[]>>(),
  /** Which domains the reveal bridged ("Fleabag → Louis Poulsen"). */
  bridges: jsonb().$type<{ from: string; to: string; domain: string }[]>(),
  /** Where people with this taste are in their city: the strongest areas, named by Qloo's places. */
  areas: jsonb().$type<TasteArea[]>(),
  computedAt: timestamp({ withTimezone: true }),
  runId: uuid().references(() => runs.id, { onDelete: "set null" }),
})

/** A pick someone kept (rule 3): from any domain, for a person. */
export const savedPicks = pgTable(
  "saved_picks",
  {
    id: uuid().defaultRandom().primaryKey(),
    personId: uuid()
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    qlooId: text().notNull(),
    type: text().notNull(),
    name: text().notNull(),
    imageUrl: text(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("saved_picks_person_entity_idx").on(t.personId, t.qlooId)],
)

export type SignalKind =
  | "seen"
  | "dwell"
  | "play"
  | "love"
  | "unlove"
  | "hide"
  | "save"
  | "unsave"
  | "open"

/**
 * What someone did with a card (W4): seen, watched for a while, played, loved, hid, kept, opened.
 * The feed skips what was just seen; loves and hides change the taste; the rest is history the
 * graph's time slider and the agent read.
 */
export const signals = pgTable(
  "signals",
  {
    id: uuid().defaultRandom().primaryKey(),
    personId: uuid()
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    qlooId: text().notNull(),
    type: text().notNull(),
    kind: text().$type<SignalKind>().notNull(),
    /** Milliseconds watched or listened, for dwell and play. */
    value: doublePrecision(),
    /** Where it happened: feed, taste, graph, room… */
    surface: text().default("feed").notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("signals_person_time_idx").on(t.personId, t.createdAt),
    index("signals_person_entity_idx").on(t.personId, t.qlooId),
  ],
)
