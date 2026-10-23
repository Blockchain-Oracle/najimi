"use client"

import { cn } from "@najimi/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react"

/*
 * One channel of the mixing desk: how much of a category the feed plays. A tall track that snaps
 * between Off, Less, Normal and More, filling with the aura as it rises; its cap is the artwork of
 * that category's next card, so you see what you're turning up. Drag, tap a height, or use the
 * arrow keys. Hand-built; the springs match the tab bar's.
 */

const SPRING = { type: "spring", stiffness: 420, damping: 32 } as const
const TRACK = 164
const CAP = 34

/** A faint tick under the finger on Android (a no-op elsewhere). */
const tick = () => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(1)
}

export function Fader({
  label,
  levelLabel,
  icon: Icon,
  image,
  value,
  levels,
  onValueChange,
}: {
  label: string
  /** The word for the current level (Off, Less…). */
  levelLabel: string
  icon: LucideIcon
  image: string | null
  value: number
  /** Number of positions (Off … More). */
  levels: number
  onValueChange: (value: number) => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [dragging, setDragging] = useState(false)
  const top = levels - 1
  const travel = TRACK - CAP
  const y = travel - (value / top) * travel

  const levelAt = (clientY: number) => {
    const rect = track.current?.getBoundingClientRect()
    if (!rect) return value
    const share = 1 - (clientY - rect.top - CAP / 2) / (rect.height - CAP)
    return Math.max(0, Math.min(top, Math.round(share * top)))
  }
  const set = (next: number) => {
    if (next === value) return
    tick()
    onValueChange(next)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    set(levelAt(e.clientY))
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) set(levelAt(e.clientY))
  }
  const onPointerUp = () => setDragging(false)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const by =
      e.key === "ArrowUp" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowDown" || e.key === "ArrowLeft"
          ? -1
          : 0
    if (!by) return
    e.preventDefault()
    set(Math.max(0, Math.min(top, value + by)))
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={top}
        aria-valuenow={value}
        aria-valuetext={levelLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative w-10 touch-none rounded-pill bg-white/[0.07] outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
        style={{ height: TRACK }}
      >
        {/* The detents. */}
        {Array.from({ length: levels }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: positions are fixed
            key={i}
            aria-hidden
            className="absolute left-1/2 h-px w-3 -translate-x-1/2 bg-white/20"
            style={{ top: CAP / 2 + travel - (i / top) * travel }}
          />
        ))}
        {/* The level, lit in the aura. */}
        <motion.span
          aria-hidden
          className="absolute inset-x-0 bottom-0 rounded-pill bg-[linear-gradient(to_top,var(--color-aura-2),var(--color-aura-1))]"
          initial={false}
          animate={{ height: TRACK - y, opacity: value === 0 ? 0 : 0.9 }}
          transition={reduce ? { duration: 0 } : SPRING}
        />
        {/* The cap: the next card of this kind. */}
        <motion.span
          aria-hidden
          className={cn(
            "absolute left-1/2 grid -translate-x-1/2 place-items-center overflow-hidden rounded-full bg-white text-black shadow-float ring-2 ring-white",
            dragging && "scale-110",
          )}
          style={{ width: CAP, height: CAP, top: 0 }}
          initial={false}
          animate={{ y }}
          transition={reduce ? { duration: 0 } : SPRING}
        >
          {image ? (
            // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
            <img
              src={image}
              alt=""
              draggable={false}
              className={cn("size-full object-cover", value === 0 && "grayscale")}
            />
          ) : (
            <Icon className="size-4" />
          )}
        </motion.span>
      </div>
      <span
        className={cn(
          "flex flex-col items-center gap-1 transition-colors",
          value === 0 ? "text-white/35" : "text-white/85",
        )}
      >
        <Icon className="size-4" />
        <span className="max-w-[3.25rem] truncate text-[10px] font-semibold">{label}</span>
      </span>
    </div>
  )
}
