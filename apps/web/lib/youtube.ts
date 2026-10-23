import "server-only"
import { YOUTUBE } from "@najimi/config"
import type { Candidate } from "@najimi/connectors"
import { channelName } from "@najimi/connectors/exports"
import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

/*
 * A connected YouTube account, read with Google's read-only YouTube scope (asked for only when
 * the person taps Connect YouTube): the channels they subscribe to and the videos they liked.
 * Channels become exact-name candidates (an artist's "Topic" channel is the artist); liked videos'
 * titles are read for the culture they name.
 */

type Page<T> = { items?: T[]; nextPageToken?: string }
type Subscription = { snippet?: { title?: string } }
type Video = { snippet?: { title?: string; channelTitle?: string } }

/** The person's Google account row, if it carries the YouTube scope. */
export async function youtubeAccount(userId: string) {
  const [row] = await db
    .select({ id: schema.account.id, scope: schema.account.scope })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "google")))
  if (!row) return null
  return { id: row.id, readable: Boolean(row.scope?.split(/[\s,]+/).includes(YOUTUBE.readonly)) }
}

async function pages<T>(path: string, token: string, max: number): Promise<T[]> {
  const out: T[] = []
  let next: string | undefined
  for (let i = 0; i < max; i++) {
    const url = new URL(`${YOUTUBE.api}/${path}`)
    url.searchParams.set("maxResults", "50")
    if (next) url.searchParams.set("pageToken", next)
    const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
    if (!r.ok) {
      if (i === 0)
        throw new Error(
          r.status === 403 ? "YouTube didn't allow the read" : "YouTube didn't answer",
        )
      break
    }
    const page = (await r.json()) as Page<T>
    out.push(...(page.items ?? []))
    next = page.nextPageToken
    if (!next) break
  }
  return out
}

/** What a connected YouTube holds: subscribed channels as candidates, liked videos' titles. */
export async function readYouTube(accountId: string) {
  const { accessToken } = await auth.api.getAccessToken({
    body: { accountId },
    headers: await headers(),
  })
  if (!accessToken) throw new Error("Connect YouTube again")
  const [subs, liked] = await Promise.all([
    pages<Subscription>(
      "subscriptions?part=snippet&mine=true&order=relevance",
      accessToken,
      YOUTUBE.subscriptionPages,
    ),
    pages<Video>("videos?part=snippet&myRating=like", accessToken, YOUTUBE.likedPages).catch(
      () => [],
    ),
  ])
  const channels: Candidate[] = [
    ...new Set(subs.flatMap((s) => (s.snippet?.title ? [channelName(s.snippet.title)] : []))),
  ]
    .filter((name) => name.length >= 2)
    .map((name) => ({ name, type: null, exactName: true }))
  const titles = liked.flatMap((v) =>
    v.snippet?.title ? [`${v.snippet.title} (${channelName(v.snippet.channelTitle ?? "")})`] : [],
  )
  return { channels, titles, subscriptions: subs.length, likes: liked.length }
}
