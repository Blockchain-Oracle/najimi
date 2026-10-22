import { mediaFor } from "@najimi/sources"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

const PLAYABLE = [
  "urn:entity:artist",
  "urn:entity:podcast",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:book",
] as const

const input = z.object({
  qlooId: z.string().min(8).max(64),
  type: z.enum(PLAYABLE),
  name: z.string().trim().min(1).max(300),
  image: z.url().max(2000).nullable(),
  // Lookup keys only (public catalogues); a malformed one is dropped, not an error.
  ids: z
    .object({
      wikidata: id(/^Q\d{1,12}$/i),
      imdb: id(/^tt\d{5,12}$/),
      itunes: id(/^\d{3,15}$/),
      isbn13: id(/^\d{13}$/),
    })
    .optional(),
})

function id(pattern: RegExp) {
  return z.string().regex(pattern).optional().catch(undefined)
}

/**
 * What one pick plays, for the pick sheet: an artist's songs (Apple previews), a podcast's latest
 * episode, a film's trailer, a book's cover. The same lookups (and cache) the feed uses.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!allow(`pick-media:${auth.session.user.id}`, 40, 60_000))
    return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const pick = parsed.data
  const media = await mediaFor([pick]).catch(() => ({}) as Awaited<ReturnType<typeof mediaFor>>)
  return json({ media: media[pick.qlooId] ?? null })
}
