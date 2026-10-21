"use client"

/*
 * Where in a city a taste lives (Qloo urn:heatmap): every cell on a dark map, brighter where the
 * affinity is higher, and the strongest areas named from Qloo's own places. Tiles: OpenStreetMap's
 * own (attributed below the map), darkened to sit in the room.
 */

type Point = { lat: number; lon: number; affinity: number }
type Area = { name: string; lat: number; lon: number; affinity: number; places: string[] }

const TILE = 256
const project = (lat: number, lon: number, z: number) => {
  const n = 2 ** z
  const x = ((lon + 180) / 360) * n * TILE
  const rad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * TILE
  return { x, y }
}

export function HeatmapView({
  points,
  areas,
  attribution,
}: {
  points: Point[]
  areas: Area[]
  attribution: string
}) {
  const W = 640
  const H = 400
  const strong = [...points]
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, Math.max(40, Math.floor(points.length * 0.35)))
  const lats = strong.map((p) => p.lat)
  const lons = strong.map((p) => p.lon)
  const box = {
    n: Math.max(...lats),
    s: Math.min(...lats),
    e: Math.max(...lons),
    w: Math.min(...lons),
  }
  // The largest zoom at which the strong cells fit.
  let z = 15
  for (; z > 3; z--) {
    const a = project(box.n, box.w, z)
    const b = project(box.s, box.e, z)
    if (b.x - a.x < W * 0.85 && b.y - a.y < H * 0.85) break
  }
  const centre = project((box.n + box.s) / 2, (box.e + box.w) / 2, z)
  const origin = { x: centre.x - W / 2, y: centre.y - H / 2 }
  const tiles: { x: number; y: number; key: string }[] = []
  for (let tx = Math.floor(origin.x / TILE); tx <= Math.floor((origin.x + W) / TILE); tx++)
    for (let ty = Math.floor(origin.y / TILE); ty <= Math.floor((origin.y + H) / TILE); ty++)
      tiles.push({ x: tx, y: ty, key: `${tx}-${ty}` })
  const at = (lat: number, lon: number) => {
    const p = project(lat, lon, z)
    return { x: p.x - origin.x, y: p.y - origin.y }
  }
  const cell = Math.max(6, 2 ** (z - 10) * 3)

  return (
    <figure className="flex flex-col gap-1.5">
      <div
        className="relative overflow-hidden rounded-tile bg-[#0f0d12]"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 size-full"
          role="img"
          aria-label={areas.map((a) => a.name).join(", ")}
        >
          {tiles.map((t) => (
            <image
              key={t.key}
              href={`https://tile.openstreetmap.org/${z}/${t.x}/${t.y}.png`}
              style={{
                filter:
                  "invert(1) hue-rotate(180deg) brightness(0.75) contrast(0.85) saturate(0.4)",
              }}
              x={t.x * TILE - origin.x}
              y={t.y * TILE - origin.y}
              width={TILE}
              height={TILE}
            />
          ))}
          {points.map((p, i) => {
            const { x, y } = at(p.lat, p.lon)
            if (x < -cell || y < -cell || x > W + cell || y > H + cell) return null
            return (
              <circle
                // biome-ignore lint/suspicious/noArrayIndexKey: cells have no id but their order is stable
                key={i}
                cx={x}
                cy={y}
                r={cell}
                fill="#c9ff3d"
                opacity={Math.max(0.04, p.affinity ** 3 * 0.55)}
              />
            )
          })}
          {areas.map((a, i) => {
            const { x, y } = at(a.lat, a.lon)
            return (
              <g key={a.name} transform={`translate(${x} ${y})`}>
                <circle r={7} fill="#c9ff3d" stroke="#0b0b0e" strokeWidth={3} />
                <text
                  x={12}
                  y={4}
                  fill="#fff"
                  fontSize={13}
                  fontWeight={700}
                  paintOrder="stroke"
                  stroke="#0b0b0e"
                  strokeWidth={4}
                >
                  {i + 1}. {a.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="text-[10px] text-paper-muted">{attribution}</figcaption>
    </figure>
  )
}
