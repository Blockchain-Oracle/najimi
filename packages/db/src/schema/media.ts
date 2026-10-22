import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { chats } from "./chat"
import { owner, runs, timestamps } from "./core"
import { people } from "./taste"

/** A photo someone added: re-encoded (EXIF stripped) and stored privately under a random key. */
export const uploads = pgTable(
  "uploads",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    s3Key: text().notNull(),
    mime: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    bytes: integer().notNull(),
    sha256: text().notNull(),
    status: text().$type<"pending" | "ready">().default("ready").notNull(),
    /** Sample room photos shipped with the app: readable by everyone. */
    sample: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("uploads_owner_idx").on(t.ownerId, t.createdAt)],
)

/**
 * One provider request (an image edit with N variants, or one video). It survives restarts: a
 * submitted request is resumed by its provider id, never sent twice.
 */
export const mediaJobs = pgTable(
  "media_jobs",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    chatId: uuid().references(() => chats.id, { onDelete: "set null" }),
    toolCallId: text(),
    kind: text().$type<"image" | "video">().notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    providerRequestId: text(),
    status: text()
      .$type<"queued" | "submitted" | "running" | "done" | "failed" | "refused">()
      .default("queued")
      .notNull(),
    input: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    error: text(),
    attempts: integer().default(0).notNull(),
    runId: uuid().references(() => runs.id, { onDelete: "set null" }),
    submittedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("media_jobs_status_idx").on(t.status, t.kind)],
)

/** Something Najimi made: an image or a video, with the taste words it was made from (rule 2). */
export const creations = pgTable(
  "creations",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    mediaJobId: uuid().references(() => mediaJobs.id, { onDelete: "set null" }),
    chatId: uuid().references(() => chats.id, { onDelete: "set null" }),
    personId: uuid().references(() => people.id, { onDelete: "set null" }),
    kind: text().$type<"image" | "video">().notNull(),
    /** restyle, dish, mood, portrait, scene, film. */
    purpose: text().notNull(),
    status: text().$type<"pending" | "ready" | "failed" | "refused">().default("pending").notNull(),
    title: text(),
    prompt: text().notNull(),
    words: jsonb().$type<string[]>().default([]).notNull(),
    sourceUploadId: uuid().references(() => uploads.id, { onDelete: "set null" }),
    sourceCreationId: uuid(),
    s3Key: text(),
    displayKey: text(),
    thumbKey: text(),
    posterKey: text(),
    mime: text(),
    width: integer(),
    height: integer(),
    durationS: real(),
    /** Public creations: readable without a session. */
    public: boolean().default(false).notNull(),
    error: text(),
    ...timestamps,
  },
  (t) => [
    index("creations_owner_idx").on(t.ownerId, t.createdAt),
    index("creations_job_idx").on(t.mediaJobId),
  ],
)
