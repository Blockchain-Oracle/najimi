"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { LOVES } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { MapPin, Search } from "lucide-react"
import type { Map as MapLibreMap, Marker } from "maplibre-gl"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import type { PlaceHit } from "@/app/api/qloo/places/route"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"

/*
 * "Where are you": a real map, after mapcn's MapLibre components (21st.dev, @mapcn), on
 * OpenFreeMap's free dark style. Search names a city from Qloo's own localities; picking one flies
 * there and drops a lime pin, so places near you come from the same point Qloo uses.
 */

export type City = { name: string; lat: number; lon: number }

const STYLE = "https://tiles.openfreemap.org/styles/dark"
const WORLD = { center: [12, 20] as [number, number], zoom: 1.2 }

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

export function CityMap({
  city,
  onCity,
  ensureSession,
}: {
  city: City | null
  onCity: (city: City | null) => void
  ensureSession: () => Promise<void>
}) {
  const t = useTranslations("Start")
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const pin = useRef<Marker | null>(null)
  const [ready, setReady] = useState(false)
  const [text, setText] = useState("")
  const [open, setOpen] = useState(false)
  const q = useDebounced(text.trim(), LOVES.searchDebounceMs)

  const places = useQuery({
    queryKey: ["places", q],
    queryFn: async () => {
      await ensureSession()
      return api<{ places: PlaceHit[] }>(`/api/qloo/places?q=${encodeURIComponent(q)}`)
    },
    enabled: q.length >= LOVES.searchMinChars,
    staleTime: Number.POSITIVE_INFINITY,
  })

  // The map is made once, on the client (MapLibre needs the window); flights below follow the city.
  // biome-ignore lint/correctness/useExhaustiveDependencies: made once, from the city it starts with
  useEffect(() => {
    let cancelled = false
    void import("maplibre-gl").then(({ Map: MapLibre, setWorkerUrl, getVersion }) => {
      if (cancelled || !box.current) return
      // The worker comes from public/ (scripts/vendor-maplibre.mjs): Next doesn't bundle it.
      setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${getVersion()}`)
      const instance = new MapLibre({
        container: box.current,
        style: STYLE,
        center: city ? [city.lon, city.lat] : WORLD.center,
        zoom: city ? 10 : WORLD.zoom,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      })
      instance.on("load", () => {
        setReady(true)
        // Credits stay one tap away (the ⓘ), not open over the map on a phone.
        instance
          .getContainer()
          .querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show")
      })
      map.current = instance
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
  }, [])

  // The pin follows the chosen city.
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return
    pin.current?.remove()
    pin.current = null
    if (!city) return
    void import("maplibre-gl").then(({ Marker }) => {
      const el = document.createElement("div")
      el.className = "najimi-pin"
      el.innerHTML = `<span class="najimi-pin-label"></span><span class="najimi-pin-dot"></span>`
      const label = el.querySelector(".najimi-pin-label")
      if (label) label.textContent = city.name
      pin.current = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([city.lon, city.lat])
        .addTo(instance)
    })
    instance.flyTo({ center: [city.lon, city.lat], zoom: 10.5, speed: 1.4, curve: 1.5 })
  }, [city, ready])

  const choose = (place: PlaceHit) => {
    onCity({ name: place.name, lat: place.lat, lon: place.lon })
    setText("")
    setOpen(false)
    sound("place")
  }

  const hits = places.data?.places ?? []

  return (
    <div className="relative overflow-hidden rounded-sheet bg-[#1b1a1f] shadow-paper">
      <div
        ref={box}
        className="h-[min(56svh,480px)] w-full"
        aria-label={t("mapLabel")}
        role="img"
      />
      {!ready ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-text-3">
          <span className="size-2 animate-lime-pulse rounded-full bg-lime" />
        </div>
      ) : null}

      <div className="absolute inset-x-3 top-3">
        <div className="flex items-center gap-2 rounded-pill bg-card px-4 py-2.5 text-card-foreground shadow-paper focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-4 shrink-0 text-paper-muted" />
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder={city ? city.name : t("citySearch")}
            aria-label={t("citySearch")}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-paper-muted"
          />
        </div>
        {open && hits.length ? (
          <ul className="mt-2 overflow-hidden rounded-tile bg-card text-card-foreground shadow-paper">
            {hits.map((p) => (
              <li key={p.qlooId}>
                <button
                  type="button"
                  onClick={() => choose(p)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-paper-foreground/6 focus-visible:bg-paper-foreground/6"
                >
                  <MapPin className="size-4 shrink-0 text-lime-ink" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{p.name}</span>
                    {p.caption ? (
                      <span className="truncate text-xs text-paper-muted">{p.caption}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {city ? (
        <button
          type="button"
          onClick={() => {
            onCity(null)
            map.current?.flyTo({ ...WORLD, speed: 1.4 })
            sound("tap")
          }}
          className={cn(
            "absolute start-3 bottom-3 rounded-pill bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm",
          )}
        >
          {t("cityClear")}
        </button>
      ) : null}
    </div>
  )
}
