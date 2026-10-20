"use client"

import { useId, useRef, useState } from "react"

type Point = { date: string; percentile: number | null }

const W = 640
const H = 160
const PAD = { top: 12, right: 12, bottom: 24, left: 36 }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })

/**
 * How attention to the business moves, week by week (Qloo trending: population percentile). One
 * series: a 2px ink line, a hairline baseline, a crosshair that snaps to the nearest week with its
 * value (dataviz: the crosshair finds the X), and a table for screen readers.
 */
export function AttentionLine({ points, entity }: { points: Point[]; entity: string }) {
  const data = points.filter((p): p is { date: string; percentile: number } => p.percentile != null)
  const [hover, setHover] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const titleId = useId()
  if (data.length < 2)
    return (
      <p className="text-sm text-text-3">Not enough weeks of data from Qloo to draw a line yet.</p>
    )

  const values = data.map((d) => d.percentile)
  const lo = Math.max(0, Math.min(...values) - 5)
  const hi = Math.min(100, Math.max(...values) + 5)
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom)
  const path = data
    .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.percentile).toFixed(1)}`)
    .join(" ")
  const current = hover == null ? null : data[hover]

  return (
    <figure className="flex flex-col gap-2">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none overflow-visible"
        role="img"
        aria-labelledby={titleId}
        onPointerMove={(e) => {
          const box = svg.current?.getBoundingClientRect()
          if (!box) return
          const px = ((e.clientX - box.left) / box.width) * W
          const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (data.length - 1))
          setHover(Math.min(data.length - 1, Math.max(0, i)))
        }}
        onPointerLeave={() => setHover(null)}
      >
        <title id={titleId}>{`Attention to ${entity}, percentile by week`}</title>
        {[lo, hi].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(v) + 4}
              textAnchor="end"
              className="fill-text-3 text-[11px]"
            >
              {Math.round(v)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 4} className="fill-text-3 text-[11px]">
          {fmtDate(data[0]?.date ?? "")}
        </text>
        <text x={W - PAD.right} y={H - 4} textAnchor="end" className="fill-text-3 text-[11px]">
          {fmtDate(data.at(-1)?.date ?? "")}
        </text>
        <path
          d={path}
          fill="none"
          className="stroke-foreground"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {current && hover != null ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-text-3"
              strokeWidth={1}
            />
            <circle
              cx={x(hover)}
              cy={y(current.percentile)}
              r={4}
              className="fill-foreground stroke-background"
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>
      <figcaption className="tnum h-5 text-xs text-text-2">
        {current
          ? `${fmtDate(current.date)} · ${current.percentile.toFixed(0)}th percentile`
          : `Now: ${data.at(-1)?.percentile.toFixed(0)}th percentile of attention`}
      </figcaption>
      <table className="sr-only">
        <caption>{`Attention to ${entity}, percentile by week`}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.percentile.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
