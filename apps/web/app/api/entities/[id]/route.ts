import { tourDates } from "@najimi/booking"
import { db, schema } from "@najimi/db"
import { entities, firstExternal, idsOf, linksOf } from "@najimi/qloo"
import {
  appleArtistOf,
  cached,
  filmExtras,
  mediaFor,
  musicVideosOf,
  siteLinks,
  socialAccountsFor,
} from "@najimi/sources"
import { and, eq } from "drizzle-orm"
import { fail, json } from "@/lib/api"
import type { EntityVideo, OutLink, Site } from "@/lib/entity"
import { selfOf } from "@/lib/people"
import { allow, clientAddress } from "@/lib/rate-limit"
import { getSession } from "@/lib/session"

type Hours = Record<string, { closed?: boolean; opens?: string; closes?: string }[]>

const FILM = new Set(["urn:entity:movie", "urn:entity:tv_show"])
/** Things whose accounts Wikidata knows (TikTok and YouTube handles Qloo doesn't carry). */
const ON_WIKIDATA = new Set([
  "urn:entity:artist",
  "urn:entity:brand",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:person",
  "urn:entity:podcast",
])

const enc = encodeURIComponent
const tiktok = (q: string) => `https://www.tiktok.com/search?q=${enc(q)}`
const youtube = (q: string) => `https://www.youtube.com/results?search_query=${enc(q)}`
const onX = (q: string) => `https://x.com/search?q=${enc(q)}&f=live`
/** Its Instagram tag (#dishoom, #tronares): what people post about it. */
const tagOf = (name: string) => {
  const tag = name
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase()
  return tag.length >= 3 ? `https://www.instagram.com/explore/tags/${enc(tag)}/` : null
}
const link = (site: Site, url: string | null | undefined): OutLink[] => (url ? [{ site, url }] : [])

/**
 * One thing, opened (the entity sheet), in the same shape for every kind: its full Qloo record,
 * what it plays (songs, an episode, a trailer), how to have it (where to watch, listen or read; a
 * place's map, phone, site and hours), more videos (a film's from TMDB, an artist's music videos
 * from Apple), an artist's next concerts, what people say about it (TikTok, YouTube, Instagram,
 * X, and the review site of its kind) and the accounts to follow. Everything outside Qloo is
 * cached. Shared pages (signed out) open things too, at a lower rate.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const userId = session?.user.id ?? null
  const id = (await ctx.params).id
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return fail("Unknown thing", 404)
  const allowed = userId
    ? allow(`entity:${userId}`, 60, 60_000)
    : allow(`entity:ip:${clientAddress(request)}`, 20, 60_000)
  if (!allowed) return fail("Slow down a little", 429)
  const region = new URL(request.url).searchParams.get("region")?.toUpperCase() ?? "US"

  const found = await entities({ ids: [id] }, { userId, purpose: "Opening a pick" }).catch(
    () => null,
  )
  const item = found?.data[0]
  if (!item?.type) return fail("Unknown thing", 404)
  const type = item.type
  const ids = idsOf(item)
  const links = linksOf(item)
  const p = item.properties as {
    address?: string
    phone?: string
    website?: string
    official_site?: string
    hours?: Hours
    price_level?: number
    business_rating?: number
    release_year?: number
    publication_year?: number
    description?: string
    short_description?: string
    geocode?: { city?: string }
  }
  const ext = (key: string) => firstExternal(item, key)
  const website = p.website ?? p.official_site ?? item.handles.website ?? null
  const isPlace = type === "urn:entity:place"
  const isArtist = type === "urn:entity:artist"
  const name = item.name

  const [media, site, extras, wiki, apple, saved] = await Promise.all([
    mediaFor([{ qlooId: item.entityId, type, name, image: item.image, ids }])
      .then((m) => m[item.entityId] ?? null)
      .catch(() => null),
    (isPlace || type === "urn:entity:brand") && website
      ? siteLinks(website).catch(() => null)
      : Promise.resolve(null),
    FILM.has(type) && ids.imdb
      ? filmExtras(ids.imdb, region).catch(() => null)
      : Promise.resolve(null),
    ON_WIKIDATA.has(type) && ids.wikidata
      ? socialAccountsFor([ids.wikidata])
          .then((s) => s[ids.wikidata?.toUpperCase() ?? ""] ?? null)
          .catch(() => null)
      : Promise.resolve(null),
    isArtist ? appleArtistOf({ name, wikidata: ids.wikidata }).catch(() => null) : null,
    // Whether you already kept it (the sheet's Keep shows Kept).
    (userId ? selfOf(userId) : Promise.resolve(null)).then(async (self) => {
      if (!self) return false
      const [row] = await db
        .select({ id: schema.savedPicks.id })
        .from(schema.savedPicks)
        .where(
          and(eq(schema.savedPicks.personId, self.id), eq(schema.savedPicks.qlooId, item.entityId)),
        )
      return Boolean(row)
    }),
  ])
  const [tour, musicVideos] = await Promise.all([
    // An artist's next concerts (Ticketmaster), checked once a day.
    isArtist
      ? cached("tour", `${item.entityId}:${region}`, 1, () => tourDates(name, region)).catch(
          () => [],
        )
      : [],
    apple ? musicVideosOf(apple) : [],
  ])

  const placeId = (() => {
    const g = item.external.google_place
    const first = Array.isArray(g) ? g[0] : g
    return first && typeof first === "object" && "place_id" in first ? String(first.place_id) : null
  })()
  const where = [name, p.address].filter(Boolean).join(", ")
  const maps = `https://www.google.com/maps/search/?api=1${placeId ? `&query_place_id=${placeId}` : ""}&query=${enc(where)}`
  const city = p.geocode?.city ?? ""

  // How to have it: listen, read.
  const listen: OutLink[] = isArtist
    ? [
        ...link("apple_music", apple ? `https://music.apple.com/artist/${apple}` : null),
        ...link("spotify", links.spotify ?? `https://open.spotify.com/search/${enc(name)}`),
        ...link("youtube_music", `https://music.youtube.com/search?q=${enc(name)}`),
      ]
    : type === "urn:entity:podcast"
      ? [
          ...link("apple_podcasts", links.open),
          ...link("spotify", `https://open.spotify.com/search/${enc(name)}/podcasts`),
        ]
      : []
  const read: OutLink[] =
    type === "urn:entity:book"
      ? [
          ...link(
            "open_library",
            ids.isbn13
              ? `https://openlibrary.org/isbn/${ids.isbn13}`
              : `https://openlibrary.org/search?q=${enc(name)}`,
          ),
          ...link(
            "google_books",
            ids.isbn13
              ? `https://books.google.com/books?vid=ISBN${ids.isbn13}`
              : `https://www.google.com/search?tbm=bks&q=${enc(name)}`,
          ),
        ]
      : []

  // What people say, by kind: the social search where it's talked about, then its review site.
  const tag = tagOf(name)
  const say: OutLink[] = FILM.has(type)
    ? [
        ...link("tiktok", tiktok(`${name} review`)),
        ...link("youtube", youtube(`${name} review`)),
        ...link("instagram", tag),
        ...link("x", onX(name)),
        ...link(
          "letterboxd",
          type === "urn:entity:movie" && ids.imdb
            ? `https://letterboxd.com/imdb/${ids.imdb}/`
            : null,
        ),
        ...link("imdb", links.imdb),
      ]
    : isArtist
      ? [
          ...link("tiktok", tiktok(name)),
          ...link("youtube", youtube(`${name} live`)),
          ...link("instagram", tag),
          ...link("x", onX(name)),
        ]
      : isPlace
        ? [
            ...link("google", maps),
            ...link("tiktok", tiktok(`${name} ${city}`.trim())),
            ...link("instagram", tag),
            ...link("youtube", youtube(`${name} ${city}`.trim())),
          ]
        : type === "urn:entity:book"
          ? [
              ...link(
                "goodreads",
                ext("goodreads") ? `https://www.goodreads.com/book/show/${ext("goodreads")}` : null,
              ),
              ...link("tiktok", tiktok(`${name} booktok`)),
              ...link("youtube", youtube(`${name} book review`)),
            ]
          : type === "urn:entity:podcast"
            ? [
                ...link("tiktok", tiktok(`${name} podcast`)),
                ...link("youtube", youtube(`${name} podcast`)),
                ...link("x", onX(name)),
              ]
            : [
                ...link("tiktok", tiktok(name)),
                ...link("youtube", youtube(type === "urn:entity:brand" ? `${name} review` : name)),
                ...link("instagram", tag),
                ...link("x", onX(name)),
              ]

  // Its own accounts: Qloo's, then Wikidata's, then the links on its own site.
  const ig = isPlace
    ? (site?.instagram ?? item.handles.instagram ?? ext("instagram"))
    : (item.handles.instagram ?? ext("instagram") ?? site?.instagram)
  const xHandle = item.handles.twitter ?? ext("twitter") ?? wiki?.x ?? site?.x
  const tt = wiki?.tiktok ?? site?.tiktok
  const yt = wiki?.youtube
    ? `https://www.youtube.com/channel/${wiki.youtube}`
    : site?.youtube
      ? `https://www.youtube.com/${site.youtube}`
      : null
  const fb = ext("facebook") ?? site?.facebook
  const follow: OutLink[] = [
    ...link("instagram", ig ? `https://www.instagram.com/${ig}/` : null),
    ...link("tiktok", tt ? `https://www.tiktok.com/@${tt}` : null),
    ...link("x", xHandle ? `https://x.com/${xHandle}` : null),
    ...link("youtube", yt),
    ...link("facebook", fb ? `https://www.facebook.com/${fb}` : null),
    // A place's site is in its own row; a film's "website" in Qloo is often a review.
    ...link("website", isPlace || FILM.has(type) ? null : website),
  ]

  const videos: EntityVideo[] = [
    ...(extras?.videos ?? []).map((v) => ({
      id: v.youtube,
      title: v.title,
      youtube: v.youtube,
      poster: `https://i.ytimg.com/vi/${v.youtube}/mqdefault.jpg`,
    })),
    ...musicVideos.map((v) => ({
      id: v.preview,
      title: v.title,
      src: v.preview,
      poster: v.poster,
      store: v.store,
    })),
  ]

  const loc = item.location
  return json({
    entity: {
      id: item.entityId,
      type,
      name,
      image: item.image,
      caption: item.caption,
      description: p.short_description ?? p.description ?? null,
      year: p.release_year ?? p.publication_year ?? null,
    },
    media,
    links,
    saved,
    place: isPlace
      ? {
          address: p.address ?? null,
          phone: p.phone ?? null,
          website,
          hours: p.hours ?? null,
          price: p.price_level ?? null,
          rating: p.business_rating ?? null,
          lat: loc?.lat ?? null,
          lon: loc?.lon ?? null,
          maps,
          directions: `https://www.google.com/maps/dir/?api=1&destination=${enc(where)}${placeId ? `&destination_place_id=${placeId}` : ""}`,
          logo: site?.logo ?? null,
        }
      : null,
    film: FILM.has(type)
      ? { providers: extras?.providers ?? [], watchLink: extras?.watchLink ?? null }
      : null,
    logo: type === "urn:entity:brand" ? (site?.logo ?? null) : null,
    listen,
    read,
    videos,
    tour,
    say,
    follow,
  })
}
