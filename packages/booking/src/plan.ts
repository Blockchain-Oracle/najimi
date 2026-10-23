import { db, schema } from "@najimi/db"
import type { PlanRoute, PlanStop } from "@najimi/db/schema"
import { distanceKm } from "@najimi/geo"
import {
  blendLoves,
  type CallContext,
  explore,
  type Love,
  NOT_OUTINGS,
  nameAreas,
  profileInsights,
  search,
  type TasteItem,
  toPick,
} from "@najimi/qloo"
import { geocode } from "@najimi/sources"
import { routeThrough } from "./mapbox"
import { type Show, showsNear } from "./shows"
import { zonedTime } from "./time"

/*
 * Plans from taste (W16, W17). A night: drinks, food, then somewhere late, near a spot, ranked
 * for everyone going (their loves blended so each counts the same), each stop with each person's
 * own fit, and the real route between them. A trip: one area a day from the taste's own heatmap,
 * morning, afternoon and evening there. Every place is Qloo's; nothing is invented.
 */

export type Goer = { name: string; look: string | null; loves: Love[] }

const TAGS = {
  drinks: [
    "urn:tag:genre:place:restaurant:cocktail_bar",
    "urn:tag:genre:place:restaurant:bar",
    "urn:tag:genre:place:lounge",
  ],
  food: ["urn:tag:genre:place:restaurant"],
  late: [
    "urn:tag:genre:place:night_club",
    "urn:tag:genre:place:live_music_venue",
    "urn:tag:genre:place:restaurant:live_music_bar",
  ],
  morning: [
    "urn:tag:genre:place:restaurant:cafe",
    "urn:tag:genre:place:museum",
    "urn:tag:genre:place:art_gallery",
  ],
  afternoon: [
    "urn:tag:genre:place:park",
    "urn:tag:genre:place:book_store",
    "urn:tag:genre:place:art_gallery",
  ],
  evening: ["urn:tag:genre:place:restaurant"],
} as const
type Slot = keyof typeof TAGS

/** Minutes after the night's start each stop begins. */
const NIGHT = [
  { slot: "drinks", after: 0 },
  { slot: "food", after: 90 },
  { slot: "late", after: 210 },
] as const
const DAY = [
  { slot: "morning", at: "10:00" },
  { slot: "afternoon", at: "14:00" },
  { slot: "evening", at: "19:30" },
] as const

const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 14)

const hhmm = (d: Date, tz?: string) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz })

/** The best places of one kind near a spot for these loves, with where each is. */
async function placesNear(
  loves: Love[],
  slot: Slot,
  point: { lat: number; lon: number },
  radiusMeters: number,
  exclude: string[],
  ctx: CallContext,
): Promise<TasteItem[]> {
  const { items } = await profileInsights(
    loves,
    {
      filterType: "urn:entity:place",
      take: 6,
      withImage: true,
      tags: [...TAGS[slot]],
      excludeTags: NOT_OUTINGS,
      exclude: [...exclude, ...loves.map((l) => l.qlooId)],
      extra: {
        "filter.location": `POINT(${point.lon} ${point.lat})`,
        "filter.location.radius": radiusMeters,
      },
    },
    { ...ctx, purpose: `A ${slot} stop near the plan` },
    "place",
  ).catch(() => ({ items: [] as TasteItem[] }))
  return items.filter((i) => i.location)
}

/** Each goer's own fit for the chosen places (Qloo scores the shortlist against each taste). */
async function fitsFor(goers: Goer[], ids: string[], ctx: CallContext) {
  const byGoer = await Promise.all(
    goers.map((g) =>
      g.loves.length
        ? profileInsights(
            g.loves,
            { filterType: "urn:entity:place", only: ids, take: ids.length },
            { ...ctx, purpose: `How well the plan fits ${g.name}` },
            "place",
          )
            .then((r) => new Map(r.items.map((i) => [i.entityId, i.affinity])))
            .catch(() => new Map<string, number | null>())
        : Promise.resolve(new Map<string, number | null>()),
    ),
  )
  return (id: string) =>
    goers.map((g, i) => ({ name: g.name, look: g.look, fit: byGoer[i]?.get(id) ?? null }))
}

const whyOf = (item: TasteItem, loves: Love[], group: boolean) => {
  const pick = toPick(item, loves, "")
  if (group)
    return pick.because
      ? `Fits all of you; strongest through ${pick.because.name}`
      : "Fits all of you"
  return pick.because ? `Because you love ${pick.because.name}` : null
}

function stopOf(
  item: TasteItem,
  loves: Love[],
  day: number,
  slot: string,
  at: string | null,
  fits: PlanStop["fits"],
  group: boolean,
  startsAt: Date | null,
): PlanStop {
  const pick = toPick(item, loves, "")
  return {
    day,
    slot,
    qlooId: item.entityId,
    name: item.name,
    image: item.image,
    caption: item.caption,
    area: pick.area ?? null,
    lat: item.location?.lat ?? null,
    lon: item.location?.lon ?? null,
    at,
    startsAt: startsAt?.toISOString() ?? null,
    why: whyOf(item, loves, group),
    fits,
    links: pick.links,
  }
}

/** Walk when the stops are close, drive across a city. */
const profileFor = (stops: PlanStop[]): PlanRoute["profile"] => {
  const pts = stops.filter((s) => s.lat != null && s.lon != null) as (PlanStop & {
    lat: number
    lon: number
  })[]
  let far = 0
  for (let i = 1; i < pts.length; i++)
    far = Math.max(
      far,
      distanceKm(
        pts[i - 1] as { lat: number; lon: number },
        pts[i] as { lat: number; lon: number },
      ),
    )
  return far <= 1.6 ? "walking" : "driving"
}

const routeOf = (stops: PlanStop[]) =>
  routeThrough(
    stops.flatMap((s) => (s.lat != null && s.lon != null ? [{ lat: s.lat, lon: s.lon }] : [])),
    profileFor(stops),
  ).catch(() => null)

export async function planNight(input: {
  ownerId: string
  chatId?: string | null
  goers: Goer[]
  point: { lat: number; lon: number }
  area: string
  city: string | null
  startsAt: Date
  timeZone?: string
  ctx: CallContext
}) {
  const group = input.goers.length > 1
  const loves = blendLoves(input.goers.map((g) => g.loves))
  if (!loves.length) throw new Error("Pick a few loves first")
  const chosen: TasteItem[] = []
  for (const leg of NIGHT) {
    // Close first; a little wider if the area is thin.
    let found = await placesNear(
      loves,
      leg.slot,
      input.point,
      2500,
      chosen.map((c) => c.entityId),
      input.ctx,
    )
    if (!found.length)
      found = await placesNear(
        loves,
        leg.slot,
        input.point,
        6000,
        chosen.map((c) => c.entityId),
        input.ctx,
      )
    const next = found[0]
    if (next) chosen.push(next)
  }
  if (!chosen.length)
    throw new Error(`Qloo found nowhere to go around ${input.area} for this taste`)
  const fits = await fitsFor(
    input.goers,
    chosen.map((c) => c.entityId),
    input.ctx,
  )
  const stops = chosen.map((item, i) => {
    const leg = NIGHT[i] as (typeof NIGHT)[number]
    const at = new Date(input.startsAt.getTime() + leg.after * 60_000)
    return stopOf(
      item,
      loves,
      1,
      leg.slot,
      hhmm(at, input.timeZone),
      group ? fits(item.entityId) : [],
      group,
      at,
    )
  })
  const [route, shows] = await Promise.all([
    routeOf(stops),
    showsNear({
      lat: input.point.lat,
      lon: input.point.lon,
      from: input.startsAt.toISOString(),
      to: new Date(input.startsAt.getTime() + 6 * 3600_000).toISOString(),
      radiusKm: 15,
      size: 5,
    }).catch(() => [] as Show[]),
  ])
  const [plan] = await db
    .insert(schema.plans)
    .values({
      ownerId: input.ownerId,
      chatId: input.chatId ?? null,
      kind: "night",
      title: `A night around ${input.area}`,
      city: input.city,
      lat: input.point.lat,
      lon: input.point.lon,
      startsAt: input.startsAt,
      days: 1,
      party: Math.max(1, input.goers.length),
      stops,
      route,
      shows: shows.map((sh) => ({
        id: sh.id,
        name: sh.name,
        url: sh.url,
        image: sh.image,
        venue: sh.venue,
        startsAt: sh.startsAt,
        localTime: sh.localTime,
        genre: sh.genre,
      })),
      token: token(),
    })
    .returning()
  if (!plan) throw new Error("Couldn't save the plan")
  return { plan, shows }
}

export async function planTrip(input: {
  ownerId: string
  chatId?: string | null
  goers: Goer[]
  city: string
  days: number
  /** The first day, YYYY-MM-DD, in their time zone. */
  date: string
  timeZone: string
  ctx: CallContext
}) {
  const group = input.goers.length > 1
  const loves = blendLoves(input.goers.map((g) => g.loves))
  if (!loves.length) throw new Error("Pick a few loves first")
  const days = Math.max(1, Math.min(5, input.days))
  const signal = { entities: loves.map((l) => ({ id: l.qlooId, weight: l.weight })) }
  // Where this taste lives in the city: one named area a day.
  const heat = await explore(
    { filterType: "urn:heatmap", signal, filter: { city: input.city } },
    loves,
    {
      ...input.ctx,
      purpose: `Where this taste lives in ${input.city}`,
    },
  ).catch(() => null)
  const points = heat?.kind === "heatmap" ? heat.points : []
  const areas = await nameAreas(points, signal, loves, input.ctx, days, input.city).catch(() => [])
  if (!areas.length) throw new Error(`Qloo has no map of ${input.city} for this taste yet`)
  const chosen: { item: TasteItem; day: number; slot: string; at: string }[] = []
  for (let d = 0; d < days; d++) {
    const area = areas[d % areas.length] as (typeof areas)[number]
    for (const part of DAY) {
      const found = await placesNear(
        loves,
        part.slot,
        { lat: area.lat, lon: area.lon },
        2500,
        chosen.map((c) => c.item.entityId),
        input.ctx,
      )
      const next = found[0]
      if (next) chosen.push({ item: next, day: d + 1, slot: part.slot, at: part.at })
    }
  }
  if (!chosen.length) throw new Error(`Qloo found nothing for this taste in ${input.city}`)
  const fits = await fitsFor(
    input.goers,
    chosen.map((c) => c.item.entityId),
    input.ctx,
  )
  const dayOf = (n: number) => {
    const d = new Date(`${input.date}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n - 1)
    return d.toISOString().slice(0, 10)
  }
  const stops = chosen.map((c) =>
    stopOf(
      c.item,
      loves,
      c.day,
      c.slot,
      c.at,
      group ? fits(c.item.entityId) : [],
      group,
      zonedTime(dayOf(c.day), c.at, input.timeZone),
    ),
  )
  const route = await routeOf(stops)
  const first = areas[0] as (typeof areas)[number]
  const [plan] = await db
    .insert(schema.plans)
    .values({
      ownerId: input.ownerId,
      chatId: input.chatId ?? null,
      kind: "trip",
      title: `${days} ${days === 1 ? "day" : "days"} in ${input.city}`,
      city: input.city,
      lat: first.lat,
      lon: first.lon,
      startsAt: zonedTime(input.date, DAY[0].at, input.timeZone),
      days,
      party: Math.max(1, input.goers.length),
      stops,
      route,
      token: token(),
    })
    .returning()
  if (!plan) throw new Error("Couldn't save the plan")
  return { plan, areas }
}

/** Where an area is (a neighbourhood, a town): Qloo's own localities first, then its places. */
export async function locate(query: string, ctx: CallContext) {
  // OpenStreetMap first when it names a neighbourhood or street precisely ("Yaba" is in Lagos,
  // not Japan); then Qloo's own localities; then OpenStreetMap's broader answer.
  const osm = await geocode(query).catch(() => null)
  if (osm?.precise) return { name: osm.name, lat: osm.lat, lon: osm.lon }
  for (const types of [["urn:entity:locality"], ["urn:entity:place"]]) {
    const r = await search(
      { query, types, take: 3 },
      { ...ctx, purpose: `Find ${query} on the map` },
    ).catch(() => null)
    const hit = r?.data.find((i) => i.location)
    if (hit?.location) return { name: hit.name, lat: hit.location.lat, lon: hit.location.lon }
  }
  return osm ? { name: osm.name, lat: osm.lat, lon: osm.lon } : null
}
