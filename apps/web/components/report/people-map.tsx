"use client"

import { boundsOf, cellsToGeoJSON } from "@najimi/geo/shapes"
import "maplibre-gl/dist/maplibre-gl.css"
import { useMemo, useState } from "react"
import MapView, { Layer, type MapLayerMouseEvent, Marker, Source } from "react-map-gl/maplibre"
import type { Area, HeatCell } from "./types"

/** OpenFreeMap: keyless, commercial use allowed, attribution added by MapLibre (plan §6). */
const STYLE = "https://tiles.openfreemap.org/styles/positron"
/** Design lock: map heat is ink at 8–72% by Qloo affinity. */
const INK_MIN = 0.08
const INK_MAX = 0.72

/**
 * Where your people are (F3c): Qloo's own heatmap cells, each its exact geohash rectangle in ink
 * (darker = higher affinity), and the named areas (R5) pinned on top. Felt's "fold-out" panel.
 */
export default function PeopleMap({ cells, areas }: { cells: HeatCell[]; areas: Area[] }) {
  const data = useMemo(() => cellsToGeoJSON(cells), [cells])
  const bounds = useMemo(() => boundsOf(cells), [cells])
  const [hover, setHover] = useState<{
    x: number
    y: number
    affinity: number
    popularity: number
  } | null>(null)
  if (!bounds) return null

  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) return setHover(null)
    const p = f.properties as { affinity: number; popularity: number }
    setHover({ x: e.point.x, y: e.point.y, affinity: p.affinity, popularity: p.popularity })
  }

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-card bg-ash sm:h-[520px]">
      <MapView
        mapStyle={STYLE}
        initialViewState={{ bounds, fitBoundsOptions: { padding: 32 } }}
        interactiveLayerIds={["cells"]}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        cooperativeGestures
        style={{ width: "100%", height: "100%" }}
      >
        <Source id="qloo-cells" type="geojson" data={data}>
          <Layer
            id="cells"
            type="fill"
            paint={{
              "fill-color": "#000000",
              "fill-opacity": [
                "interpolate",
                ["linear"],
                ["get", "affinity"],
                0,
                INK_MIN,
                1,
                INK_MAX,
              ],
            }}
          />
        </Source>
        {areas.map((area, i) => (
          <Marker key={area.geohash} longitude={area.lon} latitude={area.lat} anchor="bottom">
            <span className="flex flex-col items-center">
              <span className="rounded-tag bg-foreground px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-background">
                {i + 1}. {area.name}
              </span>
              <span className="mt-0.5 size-3 rounded-full border-2 border-background bg-foreground" />
            </span>
          </Marker>
        ))}
      </MapView>
      {hover ? (
        <div
          className="tnum pointer-events-none absolute z-10 rounded-card border border-border bg-popover px-2.5 py-1.5 text-xs"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          Affinity {hover.affinity.toFixed(2)} · popularity {hover.popularity.toFixed(2)}
        </div>
      ) : null}
    </div>
  )
}
