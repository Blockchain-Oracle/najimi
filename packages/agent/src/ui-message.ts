import type { InferUITools, UIMessage } from "ai"
import type { ToolDefs } from "./tools"

/**
 * Where someone was when they spoke to Najimi: the screen and the thing on it ("the feed card
 * 'Beck' (music)"), so a question like "more like this" needs no explaining.
 */
export type Screen = {
  /** feed, profile, chat, map… */
  where: string
  /** What's on screen, in words the agent reads. */
  label: string
  /** The Qloo id of the thing on screen, when there is one. */
  qlooId?: string
  type?: string
}

/** What rides on a message besides its parts. */
export type ChatMeta = {
  createdAt?: number
  /** When the answer finished: with createdAt, how long the run took. */
  finishedAt?: number
  /** The model that answered (`openai:gpt-6.1-sol`). */
  model?: string
  /** Who wrote it (rooms have more than one person). */
  authorId?: string | null
  /** done, streaming, waiting (a card needs an answer), resume (answered), failed. */
  status?: "done" | "streaming" | "waiting" | "resume" | "failed"
  /** Where they were when they asked. */
  screen?: Screen
  /** Their time zone (IANA) when they asked. */
  tz?: string
  /** A failed answer's reason, in plain words. */
  error?: string
  /** A booking notice in the room: the booking as it is now, drawn as a card. */
  booking?: BookingNote
  /** A reply (or a reaction) to someone's story: the story it answers. */
  story?: { id: string; kind: string; image: string | null; label: string | null }
}

/** What a booking notice shows (no payment details, no secrets). */
export type BookingNote = {
  id: string
  ownerId: string
  kind: string
  title: string
  venue: string | null
  image: string | null
  status: string
  startsAt: string | null
  endsAt: string | null
  confirmation: string | null
  refundable: boolean
}

export type NajimiTools = InferUITools<ToolDefs>
export type NajimiUIMessage = UIMessage<ChatMeta, Record<string, never>, NajimiTools>
