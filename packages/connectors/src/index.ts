export {
  type Candidate,
  type ExternalKind,
  goodreads,
  handles,
  ImportError,
  lastfm,
  lastfmReady,
  letterboxd,
} from "./feeds"
export { type Resolved, resolve } from "./resolve"

import type { Candidate } from "./feeds"
import { goodreads, handles, lastfm, letterboxd } from "./feeds"

/** Every source someone can bring taste from by name, with no sign-in. */
export const IMPORT_SOURCES = ["letterboxd", "goodreads", "lastfm", "handles"] as const
export type ImportSource = (typeof IMPORT_SOURCES)[number]

/** The candidates one source holds for this name, link or paste. */
export async function candidatesFrom(source: ImportSource, value: string): Promise<Candidate[]> {
  switch (source) {
    case "letterboxd":
      return letterboxd(value)
    case "goodreads":
      return goodreads(value)
    case "lastfm":
      return lastfm(value)
    case "handles":
      return handles(value)
  }
}
