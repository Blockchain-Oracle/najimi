import { IMPORTS, TASTE_DOMAINS } from "@najimi/config"
import { resolve } from "@najimi/connectors"
import { db, schema } from "@najimi/db"
import type { LoveHit } from "@/app/api/qloo/search/route"
import { fail, json, withSession } from "@/lib/api"
import { googleEnabled } from "@/lib/auth"
import { namedThings } from "@/lib/named-things"
import { allow } from "@/lib/rate-limit"
import { readYouTube, youtubeAccount } from "@/lib/youtube"

/** Whether YouTube can be connected on this server, and whether this person has. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const account = googleEnabled ? await youtubeAccount(auth.session.user.id) : null
  return json({ available: googleEnabled, connected: Boolean(account?.readable) })
}

/**
 * Reads the connected YouTube (subscriptions and liked videos) and matches it to Qloo, to keep or
 * drop. Nothing is saved here.
 */
export async function POST() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const userId = auth.session.user.id
  if (!allow(`import:${userId}`, IMPORTS.perMinute, 60_000)) return fail("Slow down a little", 429)
  const account = await youtubeAccount(userId)
  if (!account?.readable) return fail("Connect YouTube first", 409)
  const read = await readYouTube(account.id).catch((e: Error) => e)
  if (read instanceof Error) return fail(read.message, 502)
  const named = await namedThings({ userId, platform: "YouTube", texts: read.titles })
  const found = await resolve([...read.channels, ...named], {
    userId,
    purpose: "Import from YouTube",
  })
  const known = new Set<string>(TASTE_DOMAINS.map((d) => d.type))
  const hits: (LoveHit & { from: string })[] = found
    .filter((f) => known.has(f.type))
    .slice(0, 40)
    .map((f) => ({
      qlooId: f.qlooId,
      type: f.type,
      name: f.name,
      image: f.image,
      caption: f.caption,
      from: f.from,
    }))
  await db
    .insert(schema.socialActions)
    .values({
      userId,
      platform: "youtube",
      kind: "read",
      target: "import",
      label: `${hits.length} found`,
      status: "done",
    })
    .catch(() => undefined)
  return json({ hits, read: { subscriptions: read.subscriptions, likes: read.likes } })
}
