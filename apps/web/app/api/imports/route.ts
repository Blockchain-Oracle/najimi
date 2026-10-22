import { IMPORTS, TASTE_DOMAINS } from "@najimi/config"
import {
  candidatesFrom,
  IMPORT_SOURCES,
  ImportError,
  lastfmReady,
  resolve,
} from "@najimi/connectors"
import { qlooConfigured } from "@najimi/qloo"
import { z } from "zod"
import type { LoveHit } from "@/app/api/qloo/search/route"
import { body, fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

const input = z.object({
  source: z.enum(IMPORT_SOURCES),
  value: z.string().trim().min(1).max(2000),
})

/** Which sources this server can read (Last.fm needs its key). */
export async function GET() {
  return json({ sources: IMPORT_SOURCES.filter((s) => s !== "lastfm" || lastfmReady()) })
}

/**
 * Taste brought in by name, with no sign-in: a Letterboxd diary, a Goodreads shelf, Last.fm top
 * artists, or pasted handles, matched to Qloo (exact external ids where there are some). Returns
 * what Qloo knows, to keep or drop; nothing is saved here.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!qlooConfigured()) return fail("Qloo isn't connected yet", 503)
  if (!allow(`import:${auth.session.user.id}`, IMPORTS.perMinute, 60_000))
    return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  try {
    const candidates = await candidatesFrom(parsed.data.source, parsed.data.value)
    const found = await resolve(candidates, {
      userId: auth.session.user.id,
      purpose: `Import from ${parsed.data.source}`,
    })
    const known = new Set<string>(TASTE_DOMAINS.map((d) => d.type))
    const hits: (LoveHit & { from: string })[] = found
      .filter((f) => known.has(f.type))
      .slice(0, IMPORTS.maxItems)
      .map((f) => ({
        qlooId: f.qlooId,
        type: f.type,
        name: f.name,
        image: f.image,
        caption: f.caption,
        from: f.from,
      }))
    return json({ hits, tried: candidates.length })
  } catch (error) {
    if (error instanceof ImportError)
      return fail(error.message, error.code === "invalid" ? 400 : 404)
    throw error
  }
}
