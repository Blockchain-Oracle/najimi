"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { EARTH } from "@najimi/config"
import type { PlanRoute, PlanShow, PlanStop } from "@najimi/db/schema"
import { toast } from "@najimi/ui/components/sonner"
import {
  BedDouble,
  CalendarPlus,
  Car,
  Footprints,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Ticket,
  X,
} from "lucide-react"
import type { Map as MapLibreMap } from "maplibre-gl"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAgent, useReportScreen } from "@/components/agent/agent-context"
import { OpenThing } from "@/components/entity/entity-provider"
import { SheetForMe } from "@/components/shell/app-header"
import { Face } from "@/components/taste/face"
import { mapsRoute, type Spot, uberLink } from "@/lib/rides"

/*
 * A plan's own page (W16, W17), open to anyone with its link: the real route on a dark map with
 * numbered stops, then each stop — when, why, who it suits — with directions, and (for the person
 * who made it) Najimi booking the table or finding the hotel. After Tripsy's map-and-sheet
 * itinerary (Refero 0e71e57c) and Google Maps' stops (23a9701d).
 */

type Plan = {
  token: string
  kind: "night" | "trip"
  title: string
  city: string | null
  startsAt: string | null
  party: number
  stops: PlanStop[]
  route: PlanRoute | null
  lat: number | null
  lon: number | null
  shows: PlanShow[]
}

type Stay = { name: string; image: string | null; status: string; startsAt: string | null }

const pillLink =
  "glass flex h-10 items-center gap-2 rounded-pill px-4 text-[14px] font-semibold transition-opacity hover:opacity-90"

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

/** A date in the viewer's own locale, written once the page is in their browser (no mismatch). */
function LocalWhen({ iso }: { iso: string }) {
  const [text, setText] = useState("")
  useEffect(() => {
    setText(
      new Date(iso).toLocaleString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
      }),
    )
  }, [iso])
  return <span>{text}</span>
}

function pin(n: number) {
  const el = document.createElement("div")
  el.className =
    "grid size-8 place-items-center rounded-full bg-signal text-[13px] font-bold text-signal-foreground shadow-float ring-4 ring-black/40"
  el.textContent = String(n)
  return el
}

export function PlanView({
  plan,
  signedIn,
  calendar,
  stays,
}: {
  plan: Plan
  signedIn: boolean
  /** One-tap Google and Outlook links (the .ics is always there). */
  calendar: { google: string; outlook: string } | null
  /** A stay booked in the plan's chat for those dates. */
  stays: Stay[]
}) {
  const router = useRouter()
  const t = useTranslations("Plans")
  const agent = useAgent()
  useReportScreen({
    where: "plan",
    label: `the plan "${plan.title}"${plan.city ? ` in ${plan.city}` : ""}: ${plan.stops.map((s) => s.name).join(", ")}`,
  })
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  // Stable across renders: the map is made once per plan.
  const located = useMemo(
    () =>
      plan.stops.filter((s) => s.lat != null && s.lon != null) as (PlanStop & {
        lat: number
        lon: number
      })[],
    [plan],
  )
  const minutes = plan.route?.legs.reduce((n, l) => n + l.minutes, 0) ?? 0
  // The located stops as places a ride or a route can go through.
  const spots: Spot[] = located.map((s) => ({
    lat: s.lat,
    lon: s.lon,
    name: s.name,
    address: s.area,
  }))

  useEffect(() => {
    let cancelled = false
    void import("maplibre-gl").then(
      ({ Map: MapLibre, Marker, LngLatBounds, setWorkerUrl, getVersion }) => {
        if (cancelled || !box.current || !located.length) return
        setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${getVersion()}`)
        const first = located[0] as { lat: number; lon: number }
        const instance = new MapLibre({
          container: box.current,
          style: EARTH.style,
          center: [first.lon, first.lat],
          zoom: 12,
          attributionControl: { compact: true },
        })
        instance.on("load", () => {
          // Credits stay one tap away (the ⓘ), not open over the plan.
          instance
            .getContainer()
            .querySelector(".maplibregl-ctrl-attrib")
            ?.classList.remove("maplibregl-compact-show")
          if (plan.route?.line.length) {
            instance.addSource("route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: plan.route.line },
              },
            })
            instance.addLayer({
              id: "route-glow",
              type: "line",
              source: "route",
              paint: {
                "line-color": "#FF5CA8",
                "line-width": 12,
                "line-opacity": 0.18,
                "line-blur": 6,
              },
              layout: { "line-cap": "round", "line-join": "round" },
            })
            instance.addLayer({
              id: "route",
              type: "line",
              source: "route",
              paint: { "line-color": "#FF5CA8", "line-width": 4 },
              layout: { "line-cap": "round", "line-join": "round" },
            })
          }
          const bounds = new LngLatBounds()
          located.forEach((s, i) => {
            new Marker({ element: pin(i + 1) }).setLngLat([s.lon, s.lat]).addTo(instance)
            bounds.extend([s.lon, s.lat])
          })
          for (const p of plan.route?.line ?? []) bounds.extend(p)
          instance.fitBounds(bounds, { padding: 56, duration: 0, maxZoom: 15 })
        })
        map.current = instance
      },
    )
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
  }, [plan, located])

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: plan.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast(t("copied"))
      }
    } catch {
      // The share sheet was closed.
    }
  }

  const days = [...new Set(plan.stops.map((s) => s.day))]
  const dateOf = (iso: string | null | undefined) =>
    iso ? new Date(iso).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

  // Back to where you came from (the chat that made it); a shared link opened cold goes home.
  const close = () => {
    const fromHere = document.referrer.startsWith(window.location.origin)
    if (fromHere && window.history.length > 1) router.back()
    else router.push(signedIn ? "/c" : "/")
  }

  return (
    <main className="dark min-h-dvh bg-background text-foreground">
      <div className="relative h-[46svh] w-full">
        <div className="absolute inset-0">
          <div ref={box} className="size-full" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4 pt-[max(env(safe-area-inset-top),16px)]">
          <button
            type="button"
            onClick={close}
            aria-label={t("open")}
            className="glass pointer-events-auto grid size-10 place-items-center rounded-full"
          >
            <X className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => void share()}
            aria-label={t("share")}
            className="glass pointer-events-auto grid size-10 place-items-center rounded-full"
          >
            <Share2 className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative z-10 -mt-6 mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-t-sheet bg-background px-4 pt-5 pb-12">
        <header className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold tracking-[0.08em] text-signal uppercase">
            {plan.kind === "night" ? t("night") : t("trip")}
          </span>
          <h1 className="font-title text-title-sm leading-tight">{plan.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-text-3">
            {plan.startsAt ? <LocalWhen iso={plan.startsAt} /> : null}
            {plan.route ? (
              <span className="flex items-center gap-1">
                {plan.route.profile === "walking" ? (
                  <Footprints className="size-3.5" />
                ) : (
                  <Car className="size-3.5" />
                )}
                {t("route", {
                  stops: plan.stops.length,
                  minutes,
                  km: Math.round(plan.route.legs.reduce((n, l) => n + l.km, 0) * 10) / 10,
                })}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={`/api/plans/${plan.token}/ics`}
              className="flex h-10 items-center gap-2 rounded-pill bg-foreground px-4 text-[14px] font-semibold text-background"
            >
              <CalendarPlus className="size-4" /> {t("calendar")}
            </a>
            {calendar ? (
              <>
                <a href={calendar.google} target="_blank" rel="noreferrer" className={pillLink}>
                  Google
                </a>
                <a href={calendar.outlook} target="_blank" rel="noreferrer" className={pillLink}>
                  Outlook
                </a>
              </>
            ) : null}
          </div>
          {located.length ? (
            <div className="flex flex-wrap gap-2">
              {located.length > 1 ? (
                <a
                  href={
                    mapsRoute(spots, plan.route?.profile === "walking" ? "walking" : "driving") ??
                    "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className={pillLink}
                >
                  <Navigation className="size-4" /> {t("wholeRoute")}
                </a>
              ) : null}
              <a href={uberLink(spots)} target="_blank" rel="noreferrer" className={pillLink}>
                <Car className="size-4" /> {t("uberAll")}
              </a>
              {signedIn && !stays.length ? (
                <button
                  type="button"
                  onClick={() =>
                    agent.ask(
                      t("askHotels", {
                        area:
                          (plan.kind === "trip" ? located[0] : located.at(-1))?.area ??
                          plan.city ??
                          "",
                        date: dateOf(plan.startsAt),
                        nights: Math.max(1, days.length),
                        party: plan.party,
                      }),
                    )
                  }
                  className={pillLink}
                >
                  <BedDouble className="size-4" />
                  {plan.kind === "trip" ? t("hotelsNear") : t("stayNight")}
                </button>
              ) : null}
            </div>
          ) : null}
          {stays.map((s) => (
            <div key={s.name} className="flex items-center gap-3 rounded-card bg-card p-3">
              {s.image ? (
                // biome-ignore lint/performance/noImgElement: remote artwork
                <img src={s.image} alt="" className="size-12 rounded-tile object-cover" />
              ) : (
                <span className="grid size-12 place-items-center rounded-tile bg-white/5">
                  <BedDouble className="size-5 text-text-3" />
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-[12px] font-semibold text-text-3">{t("yourStay")}</span>
                <span className="truncate font-heading text-[15px]">{s.name}</span>
              </span>
            </div>
          ))}
        </header>

        {days.map((day) => (
          <section key={day} className="flex flex-col gap-3">
            {days.length > 1 ? (
              <h2 className="font-heading text-[16px]">{t("day", { n: day })}</h2>
            ) : null}
            {plan.stops
              .map((s, i) => ({
                s,
                n: located.indexOf(s as PlanStop & { lat: number; lon: number }) + 1,
                i,
              }))
              .filter(({ s }) => s.day === day)
              .map(({ s, n, i }) => {
                const leg = plan.route?.legs.find((l) => l.to === n - 1)
                return (
                  <div key={`${s.slot}-${s.name}-${i}`} className="flex flex-col gap-2">
                    {leg ? (
                      <span className="flex items-center gap-1.5 ps-3 text-[12px] text-text-3">
                        {plan.route?.profile === "walking" ? (
                          <Footprints className="size-3.5" />
                        ) : (
                          <Car className="size-3.5" />
                        )}
                        {leg.minutes} min · {leg.km} km
                        {spots[n - 2] && spots[n - 1] ? (
                          <a
                            href={uberLink([spots[n - 1] as Spot], spots[n - 2])}
                            target="_blank"
                            rel="noreferrer"
                            className="ms-1 rounded-pill bg-white/8 px-2 py-0.5 font-semibold text-foreground transition-colors hover:bg-white/12"
                          >
                            {t("uber")}
                          </a>
                        ) : null}
                      </span>
                    ) : null}
                    <article className="flex gap-3 rounded-card bg-card p-3">
                      <OpenThing
                        thing={{ ...s, type: "urn:entity:place" }}
                        surface="plan"
                        className="relative shrink-0 rounded-tile"
                      >
                        {s.image ? (
                          // biome-ignore lint/performance/noImgElement: remote artwork
                          <img
                            src={sized(s.image, 320) ?? ""}
                            alt=""
                            className="size-24 rounded-tile object-cover"
                          />
                        ) : (
                          <span className="block size-24 rounded-tile bg-white/5" />
                        )}
                        {n > 0 ? (
                          <span className="absolute -top-1.5 -start-1.5 grid size-6 place-items-center rounded-full bg-signal text-[11px] font-bold text-signal-foreground">
                            {n}
                          </span>
                        ) : null}
                      </OpenThing>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-[12px] font-semibold text-text-3">
                          {s.at ? `${s.at} · ` : ""}
                          {t(`slots.${s.slot}` as "slots.drinks")}
                        </span>
                        <OpenThing
                          thing={{ ...s, type: "urn:entity:place" }}
                          surface="plan"
                          chevron
                        >
                          <span className="font-heading text-[16px] leading-tight">{s.name}</span>
                        </OpenThing>
                        {s.area ? (
                          <span className="flex items-center gap-1 text-[12px] text-text-3">
                            <MapPin className="size-3" /> {s.area}
                          </span>
                        ) : null}
                        {s.why ? <p className="text-[13px] text-text-2">{s.why}</p> : null}
                        {s.fits.length ? (
                          <span className="flex flex-wrap gap-1.5">
                            {s.fits.map((f) => (
                              <span
                                key={f.name}
                                className="inline-flex items-center gap-1 rounded-pill bg-white/8 py-0.5 ps-0.5 pe-2 text-[11px] font-semibold"
                              >
                                <Face look={f.look} name={f.name} size="xs" />
                                {f.fit != null ? `${Math.round(f.fit * 100)}%` : "—"}
                              </span>
                            ))}
                          </span>
                        ) : null}
                        <span className="mt-1 flex flex-wrap gap-2">
                          {s.lat != null && s.lon != null ? (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex h-8 items-center gap-1.5 rounded-pill bg-white/8 px-3 text-[12px] font-semibold"
                            >
                              <Navigation className="size-3.5" /> {t("directions")}
                            </a>
                          ) : null}
                          {signedIn && ["food", "drinks", "late", "evening"].includes(s.slot) ? (
                            <button
                              type="button"
                              onClick={() =>
                                agent.ask(
                                  t("askBook", {
                                    name: s.name,
                                    party: plan.party,
                                    time: s.at ?? "",
                                    date: dateOf(s.startsAt ?? plan.startsAt),
                                  }),
                                )
                              }
                              className="flex h-8 items-center gap-1.5 rounded-pill bg-white/8 px-3 text-[12px] font-semibold"
                            >
                              <Phone className="size-3.5" /> {t("callToBook")}
                            </button>
                          ) : null}
                        </span>
                      </div>
                    </article>
                  </div>
                )
              })}
          </section>
        ))}

        {plan.shows.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-[16px]">{t("showsTonight")}</h2>
            <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
              {plan.shows.map((show) => (
                <a
                  key={show.id}
                  href={show.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-44 shrink-0 snap-start flex-col gap-2 rounded-card bg-card p-2 transition-colors hover:bg-white/8"
                >
                  {show.image ? (
                    // biome-ignore lint/performance/noImgElement: the show's own picture
                    <img
                      src={show.image}
                      alt=""
                      className="aspect-video w-full rounded-tile object-cover"
                    />
                  ) : (
                    <span className="grid aspect-video w-full place-items-center rounded-tile bg-white/5">
                      <Ticket className="size-6 text-text-3" />
                    </span>
                  )}
                  <span className="line-clamp-2 px-1 text-[14px] font-semibold leading-snug">
                    {show.name}
                  </span>
                  <span className="truncate px-1 text-[12px] text-text-3">
                    {[show.localTime?.slice(0, 5), show.venue].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mx-1 mb-1 inline-flex items-center gap-1 text-[12px] font-semibold text-signal">
                    <Ticket className="size-3.5" /> {t("tickets")}
                  </span>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      {/* Outside the app's shell: Najimi's sheet lives here too, for "book this" and "find a hotel". */}
      {signedIn ? <SheetForMe /> : null}
    </main>
  )
}
