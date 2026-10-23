import { db, schema } from "@najimi/db"
import { entities, firstExternal, idsOf, linksOf } from "@najimi/qloo"
import { filmExtras, mediaFor, siteLinks } from "@najimi/sources"
import { and, eq } from "drizzle-orm"
import { fail, json } from "@/lib/api"
import { selfOf } from "@/lib/people"
import { allow, clientAddress } from "@/lib/rate-limit"
import { getSession } from "@/lib/session"

type Hours = Record<string, { closed?: boolean; opens?: string; closes?: string }[]>

const search = (base: string, q: string) => `${base}${encodeURIComponent(q)}`

/**
 * One thing, opened (the entity sheet): its full Qloo record, what it plays (songs, an episode,
 * a trailer), and where it leads, by kind: a place's map, phone, site, hours and socials; a
 * film's extra videos and where to watch it; an artist's and a brand's accounts; what people say
 * on TikTok, YouTube and Instagram. Everything outside Qloo is cached. Shared pages (a chat or
 * plan opened from a link, signed out) open things too, at a lower rate.
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
  }
  const ext = (key: string) => firstExternal(item, key)
  const instagram = item.handles.instagram ?? ext("instagram")
  const x = item.handles.twitter ?? ext("twitter")
  const website = p.website ?? p.official_site ?? item.handles.website ?? null
  const q = item.name

  const [media, site, extras, saved] = await Promise.all([
    mediaFor([{ qlooId: item.entityId, type: item.type, name: item.name, image: item.image, ids }])
      .then((m) => m[item.entityId] ?? null)
      .catch(() => null),
    (item.type === "urn:entity:place" || item.type === "urn:entity:brand") && website
      ? siteLinks(website).catch(() => null)
      : Promise.resolve(null),
    (item.type === "urn:entity:movie" || item.type === "urn:entity:tv_show") && ids.imdb
      ? filmExtras(ids.imdb, region).catch(() => null)
      : Promise.resolve(null),
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

  const placeId = (() => {
    const g = item.external.google_place
    const first = Array.isArray(g) ? g[0] : g
    return first && typeof first === "object" && "place_id" in first ? String(first.place_id) : null
  })()
  const where = [item.name, p.address].filter(Boolean).join(", ")
  const loc = item.location

  return json({
    entity: {
      id: item.entityId,
      type: item.type,
      name: item.name,
      image: item.image,
      caption: item.caption,
      description: p.short_description ?? p.description ?? null,
      year: p.release_year ?? p.publication_year ?? null,
    },
    media,
    links,
    saved,
    place:
      item.type === "urn:entity:place"
        ? {
            address: p.address ?? null,
            phone: p.phone ?? null,
            website,
            hours: p.hours ?? null,
            price: p.price_level ?? null,
            rating: p.business_rating ?? null,
            lat: loc?.lat ?? null,
            lon: loc?.lon ?? null,
            maps: search(
              `https://www.google.com/maps/search/?api=1${placeId ? `&query_place_id=${placeId}` : ""}&query=`,
              where,
            ),
            directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}${placeId ? `&destination_place_id=${placeId}` : ""}`,
            instagram: site?.instagram ?? instagram,
            tiktok: site?.tiktok ?? null,
            logo: site?.logo ?? null,
          }
        : null,
    accounts: {
      instagram: item.type === "urn:entity:place" ? null : (instagram ?? site?.instagram ?? null),
      x,
      tiktok: site?.tiktok ?? null,
      // A film's "website" in Qloo is often a review; places show theirs in the place block.
      website: ["urn:entity:place", "urn:entity:movie", "urn:entity:tv_show"].includes(item.type)
        ? null
        : website,
      logo: item.type === "urn:entity:brand" ? (site?.logo ?? null) : null,
    },
    film:
      item.type === "urn:entity:movie" || item.type === "urn:entity:tv_show"
        ? {
            imdb: links.imdb ?? null,
            letterboxd:
              item.type === "urn:entity:movie" && ids.imdb
                ? `https://letterboxd.com/imdb/${ids.imdb}/`
                : null,
            videos: extras?.videos ?? [],
            providers: extras?.providers ?? [],
            watchLink: extras?.watchLink ?? null,
          }
        : null,
    /** What people say about it, where they say it. */
    talk: {
      tiktok: search(
        "https://www.tiktok.com/search?q=",
        `${q}${item.type === "urn:entity:movie" || item.type === "urn:entity:tv_show" ? " review" : ""}`,
      ),
      youtube: search(
        "https://www.youtube.com/results?search_query=",
        `${q} ${item.type === "urn:entity:artist" ? "official video" : item.type === "urn:entity:place" ? "" : "review"}`.trim(),
      ),
    },
  })
}
