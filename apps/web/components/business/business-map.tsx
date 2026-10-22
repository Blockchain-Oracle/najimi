"use client"

import { EARTH } from "@najimi/config"
import { cellRing } from "@najimi/geo"
import type { Map as MapLibreMap } from "maplibre-gl"
import { useEffect, useRef } from "react"
import "maplibre-gl/dist/maplibre-gl.css"

/*
 * Where a business's people are: its city tilted in 3D, a column rising from every ~1 km square
 * as high as the fans' taste lives there (ranked within the city, Qloo's heatmap), the business
 * pinned, and the strongest areas named. The Earth's own colours and rise, flattened to a city.
 */

const RAMP = ["#3F70FF", "#8B5CFF", "#FF4FA3", "#FFB23E"]

type Area = { name: string; lat: number; lon: number }

function features(cells: [string, number][]) {
  const ranked = [...cells].sort((a, b) => a[1] - b[1])
  const n = Math.max(ranked.length - 1, 1)
  return {
    type: "FeatureCollection" as const,
    features: ranked.map(([g], i) => {
      const v = i / n
      return {
        type: "Feature" as const,
        properties: { v, h: 20 + v ** 3 * 1400 },
        geometry: { type: "Polygon" as const, coordinates: [cellRing(g)] },
      }
    }),
  }
}

function tag(text: string, home = false) {
  const el = document.createElement("span")
  el.className = home
    ? "flex items-center gap-2 rounded-pill bg-white py-1.5 ps-1.5 pe-3 text-[13px] font-bold text-black shadow-float"
    : "flex items-center gap-2 rounded-pill border border-white/15 bg-black/60 py-1.5 ps-2.5 pe-3 text-[12px] font-semibold text-white shadow-float backdrop-blur-md"
  el.innerHTML = home
    ? `<span class="relative flex size-5 items-center justify-center"><span class="absolute inset-0 animate-ping rounded-full bg-signal opacity-60"></span><span class="relative size-3 rounded-full bg-signal ring-2 ring-white"></span></span><span></span>`
    : `<span class="size-1.5 rounded-full bg-signal"></span><span></span>`
  ;(el.lastChild as HTMLElement).textContent = text
  return el
}

export function BusinessMap({
  name,
  centre,
  cells,
  areas,
  className,
}: {
  name: string
  centre: { lat: number; lon: number } | null
  cells: [string, number][]
  areas: Area[]
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const focus = centre ?? areas[0] ?? null

  useEffect(() => {
    if (!box.current || !focus) return
    let cancelled = false
    let raf = 0
    void import("maplibre-gl").then(({ Map: MapLibre, Marker, setWorkerUrl, getVersion }) => {
      if (cancelled || !box.current) return
      setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${getVersion()}`)
      const instance = new MapLibre({
        container: box.current,
        style: EARTH.style,
        center: [focus.lon, focus.lat],
        zoom: 11.6,
        pitch: 58,
        bearing: -18,
        maxPitch: 70,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      })
      map.current = instance
      instance.on("load", () => {
        instance.addSource("cells", { type: "geojson", data: features(cells) })
        instance.addLayer({
          id: "cells",
          type: "fill-extrusion",
          source: "cells",
          filter: [">", ["get", "v"], 0.35],
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "v"],
              0.35,
              RAMP[0] as string,
              0.6,
              RAMP[1] as string,
              0.85,
              RAMP[2] as string,
              1,
              RAMP[3] as string,
            ],
            "fill-extrusion-height": 0,
            "fill-extrusion-opacity": 0.9,
            "fill-extrusion-vertical-gradient": true,
          },
        })
        instance
          .getContainer()
          .querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show")
        for (const a of areas)
          new Marker({ element: tag(a.name), anchor: "bottom", offset: [0, -10] })
            .setLngLat([a.lon, a.lat])
            .addTo(instance)
        if (centre)
          new Marker({ element: tag(name, true), anchor: "bottom" })
            .setLngLat([centre.lon, centre.lat])
            .addTo(instance)
        // The columns rise, then the city turns slowly.
        const started = performance.now()
        const rise = (now: number) => {
          const k = Math.min(1, (now - started) / 1600)
          const eased = 1 - (1 - k) ** 3
          instance.setPaintProperty("cells", "fill-extrusion-height", ["*", ["get", "h"], eased])
          if (k < 1) raf = requestAnimationFrame(rise)
          else instance.easeTo({ bearing: 12, duration: 14_000, easing: (x) => x })
        }
        raf = requestAnimationFrame(rise)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      map.current?.remove()
      map.current = null
    }
  }, [focus, cells, areas, centre, name])

  return (
    <div className={className}>
      <div ref={box} className="size-full" />
    </div>
  )
}
