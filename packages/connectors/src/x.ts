import { SOCIAL } from "@najimi/config"
import { Rettiwt, type Tweet, TwitterError, type User } from "rettiwt-api"
import { PlatformError } from "./errors"

/*
 * X through rettiwt-api: the person's own cookies ("Do it for me") or, for a handle alone, X's
 * logged-out reads (a profile and its timeline). The cookies are the session: auth_token, ct0 and
 * twid, base64-encoded the way rettiwt expects (its "API key"). Requests are spaced out.
 */

const TIMEOUT_MS = 20_000
const DELAY_MS = 1_200

const client = (apiKey?: string) =>
  new Rettiwt({ apiKey, timeout: TIMEOUT_MS, delay: DELAY_MS, maxRetries: 2 })

/** The cookies someone pasted (a Rettiwt key, a cookie header, or the three values) as a key. */
export function xKeyFrom(input: {
  key?: string | null
  authToken?: string | null
  ct0?: string | null
  twid?: string | null
}): string {
  const fromKey = (() => {
    const raw = input.key?.trim()
    if (!raw) return null
    if (raw.includes("auth_token=")) return raw
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8")
      return decoded.includes("auth_token=") ? decoded : null
    } catch {
      return null
    }
  })()
  const jar = new Map<string, string>()
  for (const part of (fromKey ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=")
    if (k && v.length) jar.set(k.trim(), v.join("=").trim())
  }
  if (input.authToken?.trim()) jar.set("auth_token", input.authToken.trim())
  if (input.ct0?.trim()) jar.set("ct0", input.ct0.trim())
  if (input.twid?.trim()) jar.set("twid", input.twid.trim())
  const authToken = jar.get("auth_token")
  const ct0 = jar.get("ct0")
  if (!authToken || !/^[a-f0-9]{30,64}$/i.test(authToken) || !ct0 || ct0.length < 20)
    throw new PlatformError("That doesn't look like your X auth_token and ct0", "invalid")
  const cookie = [
    `auth_token=${authToken}`,
    `ct0=${ct0}`,
    ...(jar.get("twid") ? [`twid=${jar.get("twid")}`] : []),
  ].join(";")
  return Buffer.from(`${cookie};`).toString("base64")
}

/** X's errors as plain answers (codes from X's API: 32/89 bad login, 326 locked, 88 rate limit). */
function xError(e: unknown): PlatformError {
  if (e instanceof PlatformError) return e
  if (e instanceof TwitterError) {
    const codes = e.details?.map((d) => d.code) ?? []
    if (e.status === 429 || codes.includes(88))
      return new PlatformError("X asked to slow down. Najimi will try again later.", "wait")
    if (codes.includes(326) || codes.includes(64))
      return new PlatformError("X has locked this account. Open X to unlock it.", "locked")
    if (e.status === 401 || codes.includes(32) || codes.includes(89))
      return new PlatformError("X signed this session out. Connect again.", "login")
    if (codes.includes(161) || codes.includes(344))
      return new PlatformError("X won't let this account follow more people today.", "feedback")
    if (e.status === 404 || codes.includes(50) || codes.includes(63))
      return new PlatformError("No X account by that name.", "not_found")
    return new PlatformError(`X said no: ${e.message.slice(0, 160)}`, "platform")
  }
  const message = e instanceof Error ? e.message : String(e)
  if (/authenticat|unauthori|forbidden/i.test(message))
    return new PlatformError("X didn't accept these cookies. Copy them again from x.com.", "login")
  return new PlatformError(`X couldn't be reached: ${message.slice(0, 120)}`, "platform")
}

const attempt = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run()
  } catch (e) {
    throw xError(e)
  }
}

export type XAccount = {
  id: string
  username: string
  name: string | null
  image: string | null
  bio: string | null
}

const accountOf = (u: User): XAccount => ({
  id: u.id,
  username: u.userName,
  name: u.fullName || null,
  image: u.profileImage?.replace("_normal.", "_400x400.") ?? null,
  bio: u.description ?? null,
})

/** Whose cookies these are (checks they work). */
export async function xWhoAmI(key: string): Promise<XAccount> {
  const me = await attempt(() => client(key).user.details())
  if (!me) throw new PlatformError("X didn't accept these cookies", "login")
  return accountOf(me)
}

/** Pages through a cursored list until `max`. */
async function pages<T extends Tweet | User>(
  fetch: (cursor?: string) => Promise<{ list: T[]; next: string }>,
  max: number,
): Promise<T[]> {
  const out: T[] = []
  let cursor: string | undefined
  for (let page = 0; page < 10 && out.length < max; page++) {
    const batch = await fetch(cursor)
    out.push(...batch.list)
    if (!batch.next || !batch.list.length || batch.next === cursor) break
    cursor = batch.next
  }
  return out.slice(0, max)
}

/** Who the connected account follows. */
export const xFollowing = (key: string, max: number = SOCIAL.readMax) =>
  attempt(async () => {
    const x = client(key)
    return (await pages((c) => x.user.following(undefined, 100, c), max)).map(accountOf)
  })

/** Posts the connected account liked or bookmarked. */
export const xSaved = (key: string, what: "likes" | "bookmarks", max = 100) =>
  attempt(async () => {
    const x = client(key)
    return pages((c) => (what === "likes" ? x.user.likes(100, c) : x.user.bookmarks(100, c)), max)
  })

/** A public profile and its recent posts, read logged out (or with a key when there is one). */
export const xPublic = (handle: string, key?: string) =>
  attempt(async () => {
    const x = client(key)
    const user = await x.user.details(handle.replace(/^@/, ""))
    if (!user) throw new PlatformError("No X account by that name.", "not_found")
    const timeline = await x.user.timeline(user.id, SOCIAL.timelineMax)
    return { account: accountOf(user), tweets: timeline.list.slice(0, SOCIAL.timelineMax) }
  })

/** Whose posts these are and who they mention: the accounts someone reads and shares. */
export function accountsInTweets(
  tweets: Tweet[],
  own?: string,
): { username: string; name: string | null }[] {
  const out = new Map<string, string | null>()
  const me = own?.toLowerCase()
  const add = (username: string | undefined, name: string | null = null) => {
    const u = username?.toLowerCase()
    if (u && u !== me && !out.has(u)) out.set(u, name)
  }
  for (const t of tweets) {
    const shared = t.retweetedTweet ?? t.quoted
    if (shared) add(shared.tweetBy?.userName, shared.tweetBy?.fullName ?? null)
    if (t.tweetBy?.userName?.toLowerCase() !== me)
      add(t.tweetBy?.userName, t.tweetBy?.fullName ?? null)
    // The raw mention carries the account's display name, which the parsed one drops.
    const raw = (
      t.raw as {
        legacy?: { entities?: { user_mentions?: { screen_name: string; name: string }[] } }
      }
    ).legacy?.entities?.user_mentions
    for (const m of raw ?? []) add(m.screen_name, m.name || null)
    for (const m of t.entities?.mentionedUsers ?? []) add(m)
  }
  return [...out].map(([username, name]) => ({ username, name }))
}

/** Follows an account by handle. */
export const xFollow = (key: string, handle: string) =>
  attempt(async () => {
    const x = client(key)
    const user = await x.user.details(handle.replace(/^@/, ""))
    if (!user) throw new PlatformError("No X account by that name.", "not_found")
    if (user.isFollowed) return { ok: true, already: true, url: `https://x.com/${user.userName}` }
    const ok = await x.user.follow(user.id)
    return { ok, already: false, url: `https://x.com/${user.userName}` }
  })

/** Posts text (and up to four uploaded pictures) as the connected account. */
export const xPost = (key: string, text: string, images: ArrayBuffer[] = []) =>
  attempt(async () => {
    const x = client(key)
    const media = []
    for (const image of images.slice(0, 4)) media.push({ id: await x.tweet.upload(image) })
    const id = await x.tweet.post({ text, ...(media.length ? { media } : {}) })
    if (!id) throw new PlatformError("X didn't take the post", "platform")
    return { id, url: `https://x.com/i/status/${id}` }
  })

/** The words of posts (and what they quote or share), for reading the things named in them. */
export const textsOf = (tweets: Tweet[]) =>
  tweets
    .map((t) => (t.retweetedTweet ?? t).fullText ?? "")
    .map((text) => text.replace(/https:\/\/t\.co\/\S+/g, "").trim())
    .filter((text) => text.length > 12)
