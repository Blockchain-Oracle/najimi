import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { chats } from "./chat"

export type PlanKind = "night" | "trip"

/** One stop of a plan: a place (or a show, or the hotel), when, and why it's there. */
export type PlanStop = {
  /** Day of the trip (1…), or 1 for a night. */
  day: number
  /** "drinks", "food", "late", "morning", "afternoon", "evening", "stay", "show". */
  slot: string
  qlooId: string | null
  name: string
  image: string | null
  caption: string | null
  area: string | null
  lat: number | null
  lon: number | null
  /** Local time it starts, "21:00". */
  at: string | null
  /** The exact instant it starts, ISO (for calendars and reminders). */
  startsAt?: string | null
  /** In plain words: why this one, for these people. */
  why: string | null
  /** Each member's own fit (a circle's plan), 0–1. */
  fits: { name: string; look: string | null; fit: number | null }[]
  links?: Record<string, string>
  /** The booking for this stop, once there is one. */
  bookingId?: string | null
}

/** The way between stops (Mapbox Directions), drawn on the plan's map. */
export type PlanRoute = {
  profile: "walking" | "driving"
  /** GeoJSON LineString coordinates, [lon, lat]. */
  line: [number, number][]
  legs: { from: number; to: number; minutes: number; km: number }[]
}

/**
 * A plan (W16, W17): a night out or a trip, for a person or a circle, made by Najimi from their
 * taste — stops in order, the way between them, and what got booked.
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    chatId: uuid().references(() => chats.id, { onDelete: "set null" }),
    kind: text().$type<PlanKind>().notNull(),
    title: text().notNull(),
    city: text(),
    lat: doublePrecision(),
    lon: doublePrecision(),
    /** When it starts (a night's first stop, a trip's first day). */
    startsAt: timestamp({ withTimezone: true }),
    days: integer().default(1).notNull(),
    party: integer().default(1).notNull(),
    stops: jsonb().$type<PlanStop[]>().notNull(),
    route: jsonb().$type<PlanRoute | null>(),
    status: text().$type<"draft" | "booked" | "done">().default("draft").notNull(),
    /** "How was it?", answered the day after: loved, fine, not, skipped. The Passport counts it then. */
    outcome: text(),
    /** "Stop sharing": the link then opens only for its owner and the people in its chat. */
    closedAt: timestamp({ withTimezone: true }),
    /** A public link (`/plan/<token>`), for sending to people outside the app. */
    token: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("plans_owner_idx").on(t.ownerId, t.createdAt),
    index("plans_token_idx").on(t.token),
  ],
)

export type BookingKind = "hotel" | "table" | "show" | "tour"
export type BookingStatus =
  | "proposed"
  /** A phone call to the venue is under way. */
  | "calling"
  | "prebooked"
  | "paid"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "completed"

/**
 * Something booked for real (W18), with its whole life: proposed → prebooked (price held) → paid
 * → confirmed, or failed / cancelled; completed once it's happened, when Najimi asks how it was.
 */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    planId: uuid().references(() => plans.id, { onDelete: "set null" }),
    chatId: uuid().references(() => chats.id, { onDelete: "set null" }),
    kind: text().$type<BookingKind>().notNull(),
    /** nuitee, call (a phone call to the venue), ticketmaster, viator. */
    provider: text().notNull(),
    status: text().$type<BookingStatus>().default("proposed").notNull(),
    title: text().notNull(),
    venue: text(),
    qlooId: text(),
    image: text(),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    party: integer().default(1).notNull(),
    amount: doublePrecision(),
    currency: text(),
    /** The provider's ids (prebookId, bookingId, conversationId…). */
    ref: jsonb().$type<Record<string, string>>().default({}).notNull(),
    /** Whatever the provider said (rates, policies, the call's transcript summary). */
    data: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    /** Why it failed or was cancelled, in plain words. */
    note: text(),
    /** When Najimi asks how it was. */
    followUpAt: timestamp({ withTimezone: true }),
    /** How it was: loved, fine, not for me. */
    outcome: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("bookings_owner_idx").on(t.ownerId, t.createdAt),
    index("bookings_follow_idx").on(t.followUpAt),
  ],
)
