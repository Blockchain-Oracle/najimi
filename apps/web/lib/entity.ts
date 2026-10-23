import type { TourDate } from "@najimi/booking"
import type { CardMedia } from "@najimi/sources"

/**
 * Anything a card shows that can be opened: what the card already knows, so the sheet's stage
 * and title appear at once while the rest arrives.
 */
export type EntityRef = {
  qlooId: string
  type: string
  name: string
  image: string | null
  caption?: string | null
  /** How well it fits whoever's looking (0–1). */
  affinity?: number | null
  /** Each love's share of it (Qloo's explainability), for "Made of your loves". */
  shares?: { id: string; share: number }[]
  area?: string | null
  /** What the card already plays (the feed's), so the stage shows at once. */
  media?: CardMedia | null
}

/** Where a link goes, so the sheet draws its mark and name. */
export type Site =
  | "apple_music"
  | "spotify"
  | "youtube_music"
  | "apple_podcasts"
  | "open_library"
  | "google_books"
  | "tiktok"
  | "youtube"
  | "instagram"
  | "x"
  | "facebook"
  | "letterboxd"
  | "imdb"
  | "goodreads"
  | "google"
  | "website"

export type OutLink = { site: Site; url: string }

/** A video the sheet's stage plays: on YouTube (a film's), or Apple's preview (a music video). */
export type EntityVideo = {
  id: string
  title: string
  poster: string | null
  youtube?: string
  src?: string
  /** The video on Apple Music. */
  store?: string
}

/** What `/api/entities/[id]` answers: one thing, what it plays and where it leads. */
export type EntityDetails = {
  entity: {
    id: string
    type: string
    name: string
    image: string | null
    caption: string | null
    description: string | null
    year: number | null
  }
  media: CardMedia | null
  links: Record<string, string>
  /** You kept it already. */
  saved: boolean
  place: {
    address: string | null
    phone: string | null
    website: string | null
    hours: Record<string, { closed?: boolean; opens?: string; closes?: string }[]> | null
    price: number | null
    rating: number | null
    lat: number | null
    lon: number | null
    maps: string
    directions: string
    logo: string | null
  } | null
  film: {
    providers: { name: string; logo: string | null; kind: "stream" | "rent" | "buy" }[]
    watchLink: string | null
  } | null
  /** A brand's own icon. */
  logo: string | null
  /** Where to listen (an artist, a podcast) and where to read (a book). */
  listen: OutLink[]
  read: OutLink[]
  /** More videos: a film's featurettes and clips, an artist's music videos. */
  videos: EntityVideo[]
  /** An artist's next concerts. */
  tour: TourDate[]
  /** What people say about it, and where. */
  say: OutLink[]
  /** Its own accounts. */
  follow: OutLink[]
}

/** The viewer's country for "where to watch": the browser's own region, else none. */
export function regionOf(): string {
  if (typeof navigator === "undefined") return "US"
  for (const tag of navigator.languages ?? [navigator.language]) {
    const region = tag.split("-")[1]
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase()
  }
  return "US"
}

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const hm = (t?: string) => t?.replace(/^T/, "").slice(0, 5) ?? null

/**
 * Today's opening for a place, read in the viewer's clock (Qloo gives local times, "T08:00:00";
 * a close before the open runs past midnight). null when there are no hours.
 */
export function openingToday(
  hours: NonNullable<EntityDetails["place"]>["hours"],
  now = new Date(),
) {
  if (!hours) return null
  const day = hours[DAYS[now.getDay()] ?? ""]
  if (!day?.length) return null
  if (day.every((s) => s.closed)) return { open: false, until: null, from: null }
  const mins = now.getHours() * 60 + now.getMinutes()
  const toMin = (t: string | null) =>
    t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null
  for (const s of day) {
    const from = hm(s.opens)
    const until = hm(s.closes)
    const a = toMin(from)
    let b = toMin(until)
    if (a == null || b == null) continue
    if (b <= a) b += 24 * 60
    if (mins >= a && mins < b) return { open: true, until, from }
  }
  const next = day.map((s) => hm(s.opens)).find((t) => t && (toMin(t) ?? 0) > mins) ?? null
  return { open: false, until: null, from: next }
}
