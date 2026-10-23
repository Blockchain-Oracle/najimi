import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { owner } from "./core"
import { uploads } from "./media"

/** A thing a story shows (a pick, the artist of a song), so the viewer can open it. */
export type StoryThing = { qlooId: string; type: string; name: string; image: string | null }

/** A song that plays while the story shows (Apple's 30-second preview, credited). */
export type StorySong = {
  title: string
  artist: string
  preview: string
  store: string
  artwork: string | null
}

export type StoryKind = "photo" | "video" | "song" | "pick" | "plan" | "wrapped"

/**
 * A story (S18): a photo or video, a song, a pick, a plan or a Wrapped slide, with a caption, for
 * 24 hours. Who sees it follows who sees their taste; blocks hold. A photo can carry a song that
 * plays while it shows. A video is kept as uploaded until the worker makes it phone-ready.
 */
export const stories = pgTable(
  "stories",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    kind: text().$type<StoryKind>().notNull(),
    /** The photo, or the video (phone-ready once `status` is ready). */
    uploadId: uuid().references(() => uploads.id, { onDelete: "set null" }),
    /** A video's still. */
    posterId: uuid().references(() => uploads.id, { onDelete: "set null" }),
    status: text().$type<"processing" | "ready" | "failed">().default("ready").notNull(),
    thing: jsonb().$type<StoryThing>(),
    song: jsonb().$type<StorySong>(),
    /** A plan's share token, or a Wrapped's token and slide. */
    planToken: text(),
    wrapped: jsonb().$type<{ token: string; slide: number }>(),
    caption: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("stories_owner_idx").on(t.ownerId, t.expiresAt)],
)

/** Who saw a story (and how they reacted); its owner sees the list. */
export const storyViews = pgTable(
  "story_views",
  {
    storyId: uuid()
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    viewerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reaction: text(),
    at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.viewerId] })],
)
