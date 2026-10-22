"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { EARTH, LOVES } from "@najimi/config"
import { cellRing, centreOf, geohashBounds } from "@najimi/geo"
import { Orb } from "@najimi/ui/components/orb"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Crosshair, Loader2, Radar, Search, Users, X } from "lucide-react"
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PlaceHit } from "@/app/api/qloo/places/route"
import { useReportScreen } from "@/components/agent/agent-context"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { useDebounced } from "@/lib/use-debounced"
import { RadarSheet } from "./radar-sheet"
import { SceneSheet, type SceneSpot } from "./scene-sheet"

/*
 * The Earth (W11): a dark globe that spins until it knows where you are, then flies down to your
 * city and raises your taste out of it, a column per square kilometre, taller and hotter where your
 * kind of people are. Switch to a friend's taste or a circle's, one kind of thing at a time; your
 * people stand on the globe as faces. Tap a column, or a named area, for its scene.
 * After CARROT Weather's layered map and Bump's people-on-a-globe (Refero de65fc1d, 8af1edeb);
 * area tags after the Location Tag (21st.dev jatin-yadav05/location-tag), people pins after
 * mapcn's MapLibre markers (21st.dev mapcn), the radar after Aceternity's Radar Effect.
 */

type Cell = [string, number, number | null, Record<string, number>]
type Lens = {
  who: string
  name: string
  look: string | null
  city: string | null
  centre: { lat: number; lon: number } | null
}
type Heatmap = {
  lens: Lens
  city: string | null
  cells: Cell[]
  lenses: {
    people: { who: string; name: string; look: string | null }[]
    circles: { who: string; name: string }[]
  }
}
type Area = { name: string; lat: number; lon: number; affinity: number; places: string[] }
type Person = {
  userId: string
  name: string
  look: string | null
  city: string | null
  username: string | null
  lat: number
  lon: number
}

/** Cool to hot, the same arc as the wavelength dial: cobalt → violet → pink → amber. */
const RAMP = ["#3F70FF", "#8B5CFF", "#FF4FA3", "#FFB23E"]
/** The last city picked on the Earth, kept in this browser (a convenience; never required). */
const CITY_KEY = "najimi:earth-city"
const savedCity = () => {
  try {
    return window.localStorage.getItem(CITY_KEY)
  } catch {
    return null
  }
}

const KINDS = [
  "artist",
  "place",
  "tv_show",
  "movie",
  "brand",
  "book",
  "podcast",
  "videogame",
] as const
type Kind = "all" | (typeof KINDS)[number]

/** Each cell's place in the city, 0–1 (rank, not raw score: Qloo's scores bunch near the top). */
function toFeatures(cells: Cell[], kind: string) {
  const scored = cells
    .map((c) => ({ c, s: kind === "all" ? c[1] : (c[3][kind] ?? -1) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s)
  const n = Math.max(scored.length - 1, 1)
  return {
    type: "FeatureCollection" as const,
    features: scored.map(({ c }, i) => {
      const v = i / n
      return {
        type: "Feature" as const,
        properties: { g: c[0], v, h: 30 + v ** 3 * 1800 },
        geometry: { type: "Polygon" as const, coordinates: [cellRing(c[0])] },
      }
    }),
  }
}

function areaTag(area: Area, onPick: () => void) {
  const el = document.createElement("button")
  el.type = "button"
  el.className =
    "flex items-center gap-2 rounded-pill border border-white/15 bg-black/60 py-1.5 ps-2.5 pe-3 text-[13px] font-semibold text-white shadow-float backdrop-blur-md transition-transform hover:scale-105"
  el.innerHTML = `<span class="relative flex size-2"><span class="absolute inset-0 animate-ping rounded-full bg-signal opacity-75"></span><span class="relative size-2 rounded-full bg-signal"></span></span><span></span>`
  ;(el.lastChild as HTMLElement).textContent = area.name
  el.addEventListener("click", (e) => {
    e.stopPropagation()
    onPick()
  })
  return el
}

function personPin(p: Person, onPick: () => void) {
  const el = document.createElement("button")
  el.type = "button"
  el.title = p.name
  el.className =
    "grid size-8 place-items-center overflow-hidden rounded-full bg-violet text-[13px] font-bold text-white ring-2 ring-white/80 shadow-float transition-transform hover:scale-125"
  if (p.look) {
    const img = document.createElement("img")
    img.src = `/looks/${p.look}.png`
    img.alt = ""
    img.className = "size-full object-cover"
    el.appendChild(img)
  } else el.textContent = p.name.slice(0, 1).toUpperCase()
  el.addEventListener("click", (e) => {
    e.stopPropagation()
    onPick()
  })
  return el
}

export function EarthView({ me }: { me: { name: string; look: string | null } }) {
  const t = useTranslations("Earth")
  const router = useRouter()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const markers = useRef<{ areas: Marker[]; people: Marker[] }>({ areas: [], people: [] })
  const spin = useRef(true)
  const [ready, setReady] = useState(false)
  const [who, setWho] = useState("me")
  const [city, setCity] = useState<string | null>(null)
  useEffect(() => {
    const kept = savedCity()
    if (kept) setCity(kept)
  }, [])
  const [kind, setKind] = useState<Kind>("all")
  const [showPeople, setShowPeople] = useState(true)
  const [spot, setSpot] = useState<SceneSpot | null>(null)
  const [radar, setRadar] = useState(false)
  const [searching, setSearching] = useState(false)

  const heat = useQuery({
    queryKey: ["earth", who, city],
    queryFn: () =>
      api<Heatmap>(
        `/api/earth?who=${encodeURIComponent(who)}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
      ),
    staleTime: 5 * 60_000,
  })
  const shownCity = city ?? heat.data?.city ?? null
  const areas = useQuery({
    queryKey: ["earth-areas", who, shownCity],
    queryFn: () =>
      api<{ areas: Area[] }>(
        `/api/earth/areas?who=${encodeURIComponent(who)}&city=${encodeURIComponent(shownCity ?? "")}`,
      ),
    enabled: Boolean(shownCity && heat.data?.cells.length),
    staleTime: 5 * 60_000,
  })
  const people = useQuery({
    queryKey: ["earth-people"],
    queryFn: () => api<{ people: Person[] }>("/api/earth/people"),
    staleTime: 5 * 60_000,
  })

  const features = useMemo(
    () => (heat.data ? toFeatures(heat.data.cells, kind) : null),
    [heat.data, kind],
  )
  /** How strongly the taste lives at a spot: the nearest column's place in the city, 0–1. */
  const fitAt = useCallback(
    (lat: number, lon: number) => {
      let best = 0
      let nearest = Number.POSITIVE_INFINITY
      for (const f of features?.features ?? []) {
        const [w, s, e, n] = geohashBounds(f.properties.g)
        const d = (lat - (s + n) / 2) ** 2 + (lon - (w + e) / 2) ** 2
        if (d < nearest) {
          nearest = d
          best = f.properties.v
        }
      }
      return best
    },
    [features],
  )

  const kinds = useMemo(() => {
    const present = new Set(heat.data?.cells.flatMap((c) => Object.keys(c[3])) ?? [])
    return KINDS.filter((k) => present.has(k))
  }, [heat.data])

  useReportScreen(
    shownCity
      ? {
          where: "map",
          label: spot
            ? `the ${spot.name ?? "area"} scene in ${shownCity} on the map`
            : `${heat.data?.lens.name ?? "their"} taste mapped over ${shownCity}`,
        }
      : null,
  )

  // The globe, made once on the client; it turns slowly until a city is in view.
  useEffect(() => {
    let cancelled = false
    let frame = 0
    void import("maplibre-gl").then(({ Map: MapLibre, setWorkerUrl, getVersion }) => {
      if (cancelled || !box.current) return
      setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${getVersion()}`)
      const instance = new MapLibre({
        container: box.current,
        style: EARTH.style,
        center: [8, 12],
        zoom: 1.6,
        maxPitch: 75,
        attributionControl: { compact: true },
      })
      instance.on("style.load", () => {
        instance.setProjection({ type: "globe" })
        instance.setSky({
          "sky-color": "#07060c",
          "horizon-color": "#3a1f5c",
          "fog-color": "#07060c",
          "sky-horizon-blend": 0.7,
          "horizon-fog-blend": 0.8,
          "fog-ground-blend": 0.3,
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 0.8, 8, 0],
        })
      })
      instance.on("load", () => {
        instance.addSource("cells", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        })
        instance.addLayer({
          id: "cells",
          type: "fill-extrusion",
          source: "cells",
          filter: [">", ["get", "v"], 0.4],
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "v"],
              0.4,
              RAMP[0] as string,
              0.65,
              RAMP[1] as string,
              0.85,
              RAMP[2] as string,
              1,
              RAMP[3] as string,
            ],
            "fill-extrusion-height": 0,
            "fill-extrusion-opacity": 0.88,
            "fill-extrusion-vertical-gradient": true,
          },
        })
        instance.on("mouseenter", "cells", () => {
          instance.getCanvas().style.cursor = "pointer"
        })
        instance.on("mouseleave", "cells", () => {
          instance.getCanvas().style.cursor = ""
        })
        instance
          .getContainer()
          .querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show")
        setReady(true)
      })
      const stop = () => {
        spin.current = false
      }
      instance.on("mousedown", stop)
      instance.on("touchstart", stop)
      instance.on("wheel", stop)
      const turn = () => {
        if (spin.current && instance.getZoom() < 3) {
          const c = instance.getCenter()
          instance.setCenter([c.lng + 0.08, c.lat])
        }
        frame = requestAnimationFrame(turn)
      }
      frame = requestAnimationFrame(turn)
      map.current = instance
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      map.current?.remove()
      map.current = null
    }
  }, [])

  const openSpot = useCallback((next: SceneSpot) => {
    sound("tap")
    setSpot(next)
    map.current?.easeTo({ center: [next.lon, next.lat], zoom: 13.2, pitch: 60, duration: 1200 })
  }, [])

  // Tapping a column opens its scene, named after the nearest area when one is close.
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    const click = (e: { features?: { properties: Record<string, unknown> }[] }) => {
      const g = e.features?.[0]?.properties.g as string | undefined
      if (!g) return
      const [w, s, east, n] = geohashBounds(g)
      const lat = (s + n) / 2
      const lon = (w + east) / 2
      const near = areas.data?.areas.find((a) => Math.hypot(a.lat - lat, a.lon - lon) < 0.02)
      const v = Number(e.features?.[0]?.properties.v ?? 0)
      openSpot({ lat, lon, name: near?.name ?? null, city: shownCity, fit: v })
    }
    instance.on("click", "cells", click)
    return () => {
      instance.off("click", "cells", click)
    }
  }, [ready, areas.data, shownCity, openSpot])

  // The columns: drawn for the chosen kind of thing, then raised once the camera arrives.
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance || !heat.data) return
    const cells = heat.data.cells
    if (features) (instance.getSource("cells") as GeoJSONSource | undefined)?.setData(features)
    if (!cells.length) return
    let raf = 0
    const rise = () => {
      const started = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - started) / 1400)
        const eased = 1 - (1 - k) ** 3
        instance.setPaintProperty("cells", "fill-extrusion-height", ["*", ["get", "h"], eased])
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }
    if (instance.getZoom() > 8) {
      rise()
      return () => cancelAnimationFrame(raf)
    }
    spin.current = false
    // Aim at where the taste is strongest (the city's top cells), not the whole city's middle:
    // Lagos's centroid is the mainland while its strongest squares are on the islands.
    const strongest = [...cells]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(20, Math.round(cells.length * 0.08)))
    if (!strongest.length) return
    // The densest knot of strong squares (~5 km groups), so a phone opens on the scene itself.
    const groups = new Map<string, typeof strongest>()
    for (const c of strongest) {
      const key = c[0].slice(0, 5)
      groups.set(key, [...(groups.get(key) ?? []), c])
    }
    const knot =
      [...groups.values()].sort(
        (a, b) => b.reduce((t, c) => t + c[1], 0) - a.reduce((t, c) => t + c[1], 0),
      )[0] ?? strongest
    const middle = centreOf(
      knot.map((c) => {
        const [w, so, e, n] = geohashBounds(c[0])
        return { lat: (so + n) / 2, lon: (w + e) / 2 }
      }),
    )
    if (!middle) return
    instance.setPaintProperty("cells", "fill-extrusion-height", 0)
    // A phone sees less of the city at once, so it stands a little further back.
    const narrow = instance.getContainer().clientWidth < 600
    instance.flyTo({
      center: [middle.lon, middle.lat],
      zoom: narrow ? 11.4 : 11.9,
      pitch: 55,
      bearing: -20,
      duration: 4200,
      essential: true,
    })
    instance.once("moveend", rise)
    return () => cancelAnimationFrame(raf)
  }, [ready, heat.data, features])

  // Named areas as tags over the columns.
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    for (const m of markers.current.areas) m.remove()
    markers.current.areas = []
    void import("maplibre-gl").then(({ Marker: MapMarker }) => {
      for (const area of areas.data?.areas ?? []) {
        const marker = new MapMarker({
          element: areaTag(area, () =>
            openSpot({
              lat: area.lat,
              lon: area.lon,
              name: area.name,
              city: shownCity,
              fit: fitAt(area.lat, area.lon),
            }),
          ),
          anchor: "bottom",
          offset: [0, -24],
        })
          .setLngLat([area.lon, area.lat])
          .addTo(instance)
        markers.current.areas.push(marker)
      }
    })
  }, [ready, areas.data, shownCity, openSpot, fitAt])

  // Your people, standing on the globe.
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    for (const m of markers.current.people) m.remove()
    markers.current.people = []
    if (!showPeople) return
    void import("maplibre-gl").then(({ Marker: MapMarker }) => {
      for (const p of people.data?.people ?? []) {
        const marker = new MapMarker({
          element: personPin(p, () => p.username && router.push(`/u/${p.username}`)),
        })
          .setLngLat([p.lon, p.lat])
          .addTo(instance)
        markers.current.people.push(marker)
      }
    })
  }, [ready, people.data, showPeople, router])

  const lenses = heat.data?.lenses
  const loading = heat.isPending || (heat.isFetching && !heat.data)

  return (
    <div className="dark fixed inset-0 bg-[#07060c] text-foreground md:start-[5.5rem]">
      {/* MapLibre makes its container position: relative, so it sits inside a pinned box. */}
      <div className="absolute inset-0 [&_.maplibregl-ctrl-bottom-right]:mb-[calc(9rem+env(safe-area-inset-bottom))] md:[&_.maplibregl-ctrl-bottom-right]:mb-28">
        <div ref={box} className="size-full" />
      </div>

      {/* Whose taste, and where. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 p-3 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearching(true)}
            className="glass flex h-11 min-w-0 flex-1 items-center gap-2 rounded-pill px-4 text-start md:max-w-sm"
          >
            <Search className="size-4 shrink-0 text-text-3" />
            <span className="truncate text-[15px] font-semibold">{shownCity ?? t("pickCity")}</span>
            {loading ? <Loader2 className="ms-auto size-4 animate-spin text-text-3" /> : null}
          </button>
          <button
            type="button"
            onClick={() => setRadar(true)}
            aria-label={t("radar")}
            title={t("radar")}
            className="glass grid size-11 shrink-0 place-items-center rounded-full"
          >
            <Radar className="size-5" />
          </button>
        </div>
        <div className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
          {[
            { who: "me", name: t("you"), face: <Face look={me.look} name={me.name} size="xs" /> },
            ...(lenses?.people ?? []).map((p) => ({
              who: p.who,
              name: p.name,
              face: <Face look={p.look} name={p.name} size="xs" />,
            })),
            ...(lenses?.circles ?? []).map((c) => ({
              who: c.who,
              name: c.name,
              face: (
                <span className="grid size-6 place-items-center rounded-full bg-signal-soft">
                  <Users className="size-3.5 text-signal" />
                </span>
              ),
            })),
          ].map((l) => (
            <button
              key={l.who}
              type="button"
              aria-pressed={who === l.who}
              onClick={() => {
                sound("tap")
                setWho(l.who)
                setSpot(null)
              }}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-pill py-1 ps-1 pe-3 text-[13px] font-semibold transition-colors",
                who === l.who ? "bg-foreground text-background" : "glass",
              )}
            >
              {l.face}
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* The kinds of thing, people on or off, back to the city. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] flex flex-col gap-2.5 p-3 md:bottom-0">
        <div className="pointer-events-auto flex items-end justify-between gap-2">
          <div className="glass flex items-center gap-2 rounded-pill px-3 py-1.5 text-[11px] font-semibold text-text-2">
            {t("less")}
            <span
              className="h-1.5 w-20 rounded-full"
              style={{ background: `linear-gradient(90deg, ${RAMP.join(",")})` }}
            />
            {t("more")}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={showPeople}
              onClick={() => setShowPeople((v) => !v)}
              aria-label={t("people")}
              title={t("people")}
              className={cn(
                "grid size-11 place-items-center rounded-full",
                showPeople ? "bg-foreground text-background" : "glass",
              )}
            >
              <Users className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const c = heat.data?.cells
                if (!c?.length) return
                const m = centreOf(
                  c.map((x) => {
                    const [w, s, e, n] = geohashBounds(x[0])
                    return { lat: (s + n) / 2, lon: (w + e) / 2 }
                  }),
                )
                if (m)
                  map.current?.flyTo({
                    center: [m.lon, m.lat],
                    zoom: 10.8,
                    pitch: 55,
                    bearing: -20,
                  })
              }}
              aria-label={t("recentre")}
              title={t("recentre")}
              className="glass grid size-11 place-items-center rounded-full"
            >
              <Crosshair className="size-5" />
            </button>
          </div>
        </div>
        {kinds.length > 1 ? (
          <div className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
            {(["all", ...kinds] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  sound("tap")
                  setKind(k)
                }}
                className={cn(
                  "h-9 shrink-0 rounded-pill px-4 text-[13px] font-semibold transition-colors",
                  kind === k ? "bg-foreground text-background" : "glass",
                )}
              >
                {t(`kinds.${k}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!loading && heat.data && !heat.data.cells.length ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] flex justify-center p-6 md:bottom-24">
          <div className="glass pointer-events-auto flex max-w-xs flex-col items-center gap-3 rounded-sheet p-5 text-center">
            <Orb size={56} />
            <p className="text-[15px] text-text-2">
              {shownCity ? t("nothingHere", { city: shownCity }) : t("noCity")}
            </p>
            <button
              type="button"
              onClick={() => setSearching(true)}
              className="h-10 rounded-pill bg-foreground px-5 text-[14px] font-semibold text-background"
            >
              {t("pickCity")}
            </button>
          </div>
        </div>
      ) : null}

      <CitySearch
        open={searching}
        onClose={() => setSearching(false)}
        onPick={(name) => {
          setSearching(false)
          setSpot(null)
          setCity(name)
          try {
            window.localStorage.setItem(CITY_KEY, name)
          } catch {
            // Private mode: the city lasts for this visit.
          }
          map.current?.setPaintProperty("cells", "fill-extrusion-height", 0)
          map.current?.easeTo({ zoom: 3, pitch: 0, bearing: 0, duration: 900 })
        }}
      />
      <SceneSheet spot={spot} onClose={() => setSpot(null)} />
      <RadarSheet open={radar} onOpenChange={setRadar} me={me} />
    </div>
  )
}

/** Any city Qloo knows (its own localities), searched as you type. */
function CitySearch({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (city: string) => void
}) {
  const t = useTranslations("Earth")
  const [text, setText] = useState("")
  const q = useDebounced(text.trim(), LOVES.searchDebounceMs)
  const places = useQuery({
    queryKey: ["places", q],
    queryFn: () => api<{ places: PlaceHit[] }>(`/api/qloo/places?q=${encodeURIComponent(q)}`),
    enabled: open && q.length >= LOVES.searchMinChars,
    staleTime: Number.POSITIVE_INFINITY,
  })
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/70 p-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        <div className="flex items-center gap-2">
          <label className="glass flex h-12 flex-1 items-center gap-2 rounded-pill px-4">
            <Search className="size-4 text-text-3" />
            <input
              // biome-ignore lint/a11y/noAutofocus: the search opens to type into
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("searchCity")}
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-4"
            />
            {places.isFetching ? <Loader2 className="size-4 animate-spin text-text-3" /> : null}
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="glass grid size-12 place-items-center rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {(places.data?.places ?? []).map((p) => (
            <li key={p.qlooId}>
              <button
                type="button"
                onClick={() =>
                  onPick(p.caption ? `${p.name}, ${p.caption.split(",").at(-1)?.trim()}` : p.name)
                }
                className="flex w-full flex-col rounded-tile px-4 py-3 text-start transition-colors hover:bg-white/10"
              >
                <span className="text-[15px] font-semibold">{p.name}</span>
                {p.caption ? <span className="text-[13px] text-text-3">{p.caption}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
