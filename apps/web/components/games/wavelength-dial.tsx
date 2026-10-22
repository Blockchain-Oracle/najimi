"use client"

import { GAMES } from "@najimi/config"
import { motion, useReducedMotion } from "motion/react"
import { type KeyboardEvent, type PointerEvent, useId, useRef } from "react"

/*
 * Guess my wavelength, after the board game: a half dial from "not their thing" to "obsessed".
 * You swing the needle; then the screen opens on Qloo's target (three bands, the bullseye in the
 * middle) with Najimi's needle beside yours. The arc runs through the aura colours, cool to hot.
 */

const W = 320
const CX = 160
const CY = 168
const R = 148
const INNER = 46

/** 0 sits at the left end, 100 at the right; the arc bows upward. */
const angleOf = (v: number) => Math.PI - (v / 100) * Math.PI
const at = (v: number, r: number) => ({
  x: CX + r * Math.cos(angleOf(v)),
  y: CY - r * Math.sin(angleOf(v)),
})

/** A wedge of the dial from a to b (0–100), between two radii. */
function wedge(a: number, b: number, r0: number, r1: number) {
  const lo = Math.max(0, Math.min(a, b))
  const hi = Math.min(100, Math.max(a, b))
  const p0 = at(lo, r1)
  const p1 = at(hi, r1)
  const q1 = at(hi, r0)
  const q0 = at(lo, r0)
  return `M ${q0.x} ${q0.y} L ${p0.x} ${p0.y} A ${r1} ${r1} 0 0 1 ${p1.x} ${p1.y} L ${q1.x} ${q1.y} A ${r0} ${r0} 0 0 0 ${q0.x} ${q0.y} Z`
}

function valueAt(event: PointerEvent, svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect()
  const scale = rect.width / W
  const x = (event.clientX - rect.left) / scale - CX
  const y = CY - (event.clientY - rect.top) / scale
  // Below the baseline counts as the nearest end.
  const angle = Math.atan2(Math.max(y, 0), x)
  return Math.round(Math.max(0, Math.min(100, 100 - (angle / Math.PI) * 100)))
}

function Needle({
  value,
  r,
  className,
  dashed = false,
}: {
  value: number
  r: number
  className: string
  dashed?: boolean
}) {
  const tip = at(value, r)
  return (
    <line
      x1={CX}
      y1={CY}
      x2={tip.x}
      y2={tip.y}
      strokeLinecap="round"
      strokeWidth={dashed ? 3 : 5}
      strokeDasharray={dashed ? "2 7" : undefined}
      className={className}
    />
  )
}

export function WavelengthDial({
  value,
  onChange,
  reveal,
  low,
  high,
  label,
}: {
  value: number
  onChange?: (value: number) => void
  /** After answering: Qloo's number and Najimi's guess. */
  reveal?: { truth: number; najimi: number } | null
  low: string
  high: string
  label: string
}) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const still = useReducedMotion()
  const locked = !onChange || Boolean(reveal)

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (locked || !dragging.current || !svg.current) return
    const next = valueAt(event, svg.current)
    if (next !== value) {
      onChange?.(next)
      if (next % 10 === 0 && "vibrate" in navigator) navigator.vibrate(1)
    }
  }
  const key = (event: KeyboardEvent) => {
    if (locked) return
    const step = event.shiftKey ? 10 : 1
    if (event.key === "ArrowRight" || event.key === "ArrowUp")
      onChange?.(Math.min(100, value + step))
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
      onChange?.(Math.max(0, value - step))
    else return
    event.preventDefault()
  }

  const knob = at(value, R - 22)
  const [bull, near, far] = GAMES.bands

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${CY + 14}`}
        className="w-full max-w-[380px] touch-none select-none overflow-visible"
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the dial is drawn in SVG and is a slider
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-readonly={locked}
        tabIndex={locked ? -1 : 0}
        onKeyDown={key}
        onPointerDown={(event) => {
          if (locked || !svg.current) return
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          onChange?.(valueAt(event, svg.current))
        }}
        onPointerMove={move}
        onPointerUp={() => {
          dragging.current = false
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
      >
        <defs>
          <linearGradient id={`${id}-arc`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--color-cobalt)" />
            <stop offset="45%" stopColor="var(--color-aura-2)" />
            <stop offset="75%" stopColor="var(--color-aura-1)" />
            <stop offset="100%" stopColor="var(--color-aura-3)" />
          </linearGradient>
        </defs>

        {/* The face: a dim arc of the full range, lit along the gradient. */}
        <path d={wedge(0, 100, INNER, R)} className="fill-foreground/[0.06]" />
        <path d={wedge(0, 100, R - 10, R)} fill={`url(#${id}-arc)`} opacity={0.9} />
        {Array.from({ length: 11 }, (_, i) => {
          const a = at(i * 10, R - 16)
          const b = at(i * 10, R - (i % 5 === 0 ? 28 : 22))
          return (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed tick marks
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeWidth={2}
              strokeLinecap="round"
              className="stroke-foreground/25"
            />
          )
        })}

        {/* The target, revealed: far, near, bullseye. */}
        {reveal ? (
          <motion.g
            initial={still ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
            <path
              d={wedge(reveal.truth - far, reveal.truth + far, INNER, R - 12)}
              className="fill-signal/25"
            />
            <path
              d={wedge(reveal.truth - near, reveal.truth + near, INNER, R - 12)}
              className="fill-signal/50"
            />
            <path
              d={wedge(reveal.truth - bull, reveal.truth + bull, INNER, R - 12)}
              className="fill-signal"
            />
          </motion.g>
        ) : null}

        {reveal ? (
          <motion.g
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            <Needle value={reveal.najimi} r={R - 14} className="stroke-aura-2" dashed />
          </motion.g>
        ) : null}

        <Needle value={value} r={R - 14} className="stroke-foreground" />
        <circle cx={CX} cy={CY} r={12} className="fill-foreground" />
        {locked ? null : (
          <circle
            cx={knob.x}
            cy={knob.y}
            r={14}
            className="fill-foreground stroke-background"
            strokeWidth={4}
          />
        )}
      </svg>
      {low || high ? (
        <div className="flex w-full max-w-[380px] justify-between px-1 text-[12px] font-semibold text-text-3">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      ) : null}
    </div>
  )
}
