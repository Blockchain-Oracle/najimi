"use client"

import { cn } from "@najimi/ui/lib/utils"
import {
  AnimatePresence,
  type AnimationPlaybackControls,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type Variants,
} from "motion/react"
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react"

/*
 * A love's knob on the mixing desk: turn it and the love counts more or less in your taste. Its
 * face is the love's own artwork. Adapted from Kokonut UI's Detent Dial (21st.dev
 * kokonutd/kokonut-detent-dial, MIT, © 2025 kokonutUI): the 270° sweep, the pull toward each
 * notch, the flick that coasts, the swell travelling round the ticks, the rolling readout, the
 * keyboard and wheel steps. Changed here: the artwork face, the aura-lit ticks, no end labels,
 * sized for a grid of knobs.
 */

const SWEEP = 270
const START_ANGLE = -135
const MAX_OVERSHOOT = 16
const DETENT_PULL = 0.65
const WAVE_HEIGHT = 6
const WAVE_WIDTH = 14
const DEAD_ZONE = 10
const FLICK_THRESHOLD = 0.4
const VELOCITY_WINDOW_MS = 80
const COAST = 0.3
const SETTLE_SPRING = { type: "spring", duration: 0.35, bounce: 0.2 } as const
const EASE_OUT = [0.23, 1, 0.32, 1] as const

const damp = (distance: number, max: number) => max * (1 - Math.exp(-distance / max))
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const snap = (value: number, min: number, step: number) =>
  Number((Math.round((value - min) / step) * step + min).toFixed(10))

function polar(cx: number, cy: number, radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180
  return {
    x: Math.round((cx + radius * Math.sin(rad)) * 100) / 100,
    y: Math.round((cy - radius * Math.cos(rad)) * 100) / 100,
  }
}

function pointerAngle(event: PointerEvent, rect: DOMRect) {
  const dx = event.clientX - (rect.left + rect.width / 2)
  const dy = event.clientY - (rect.top + rect.height / 2)
  return { angle: (Math.atan2(dx, -dy) * 180) / Math.PI, distance: Math.hypot(dx, dy) }
}

/** A faint tick under the finger on Android (a no-op elsewhere). */
function hapticTick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(1)
}

export function Knob({
  label,
  image,
  value: valueProp,
  onValueChange,
  min = 1,
  max = 10,
  step = 1,
  defaultValue = 5,
  size = 124,
  className,
}: {
  label: string
  image: string | null
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Double-click returns here. */
  defaultValue?: number
  size?: number
  className?: string
}) {
  const labelId = useId()
  const knobRef = useRef<HTMLDivElement>(null)
  const tickRefs = useRef<(SVGLineElement | null)[]>([])
  const tickLengths = useRef<number[]>([])
  const reduceMotion = useReducedMotion()
  const range = max - min
  const initial = clamp(valueProp, min, max)
  const [value, setValue] = useState(initial)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [grabbing, setGrabbing] = useState(false)
  const committed = useRef(initial)
  const pointerType = useRef("mouse")
  const raw = useMotionValue(initial)
  const animation = useRef<AnimationPlaybackControls | null>(null)
  const drag = useRef<{
    id: number
    rect: DOMRect
    lastAngle: number
    samples: { t: number; v: number }[]
  } | null>(null)
  const onChange = useRef(onValueChange)
  onChange.current = onValueChange

  const rotation = useTransform(raw, (r) => {
    const degPerUnit = range === 0 ? 0 : SWEEP / range
    if (r < min) return START_ANGLE - damp((min - r) * degPerUnit, MAX_OVERSHOOT)
    if (r > max) return START_ANGLE + SWEEP + damp((r - max) * degPerUnit, MAX_OVERSHOOT)
    const notch = snap(r, min, step)
    const pulled = notch + (r - notch) * (1 - DETENT_PULL)
    return START_ANGLE + (pulled - min) * degPerUnit
  })

  // Re-render only when the knob crosses into a new notch.
  useMotionValueEvent(raw, "change", (r) => {
    const next = clamp(snap(r, min, step), min, max)
    if (next === committed.current) return
    setDirection(next > committed.current ? 1 : -1)
    committed.current = next
    setValue(next)
    onChange.current(next)
    if (pointerType.current === "touch") hapticTick()
  })

  // Follow the parent when it changes the value.
  useEffect(() => {
    if (drag.current) return
    const next = clamp(valueProp, min, max)
    if (next !== committed.current) {
      animation.current?.stop()
      committed.current = next
      setValue(next)
      raw.jump(next)
    }
  }, [valueProp, min, max, raw])

  useEffect(() => () => animation.current?.stop(), [])

  const settleTo = (target: number) => {
    animation.current?.stop()
    animation.current = animate(raw, target, reduceMotion ? { duration: 0 } : SETTLE_SPRING)
  }

  const stepBy = (delta: number) => {
    animation.current?.stop()
    pointerType.current = "keyboard"
    raw.jump(clamp(snap(committed.current + delta, min, step), min, max))
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current || (event.pointerType === "mouse" && event.button !== 0)) return
    const rect = event.currentTarget.getBoundingClientRect()
    animation.current?.stop()
    pointerType.current = event.pointerType
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      id: event.pointerId,
      rect,
      lastAngle: pointerAngle(event, rect).angle,
      samples: [{ t: event.timeStamp, v: raw.get() }],
    }
    setGrabbing(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    const { angle, distance } = pointerAngle(event, current.rect)
    if (distance < DEAD_ZONE) {
      current.lastAngle = angle
      return
    }
    // Unwrapped, so crossing six o'clock doesn't read as a full turn.
    let delta = angle - current.lastAngle
    if (delta > 180) delta -= 360
    else if (delta < -180) delta += 360
    current.lastAngle = angle
    const next = raw.get() + (delta / SWEEP) * range
    raw.set(next)
    current.samples.push({ t: event.timeStamp, v: next })
    while (
      current.samples.length > 2 &&
      event.timeStamp - (current.samples[0]?.t ?? 0) > VELOCITY_WINDOW_MS
    )
      current.samples.shift()
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    drag.current = null
    setGrabbing(false)
    const first = current.samples[0] ?? { t: event.timeStamp, v: raw.get() }
    const last = current.samples.at(-1) ?? first
    const elapsed = (last.t - first.t) / 1000
    const paused = event.timeStamp - last.t > VELOCITY_WINDOW_MS
    const velocity = elapsed > 0 && !paused ? (last.v - first.v) / elapsed : 0
    const position = raw.get()
    const inBounds = position >= min && position <= max
    if (reduceMotion || !inBounds || Math.abs(velocity) < range * FLICK_THRESHOLD) {
      settleTo(clamp(snap(position, min, step), min, max))
      return
    }
    // A flick coasts and lands on a notch, bouncing off an end rather than stopping dead.
    animation.current?.stop()
    animation.current = animate(
      raw,
      clamp(snap(position + velocity * COAST, min, step), min, max),
      {
        type: "spring",
        velocity,
        stiffness: 140,
        damping: 24,
        restDelta: 0.005,
      },
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      Home: min - committed.current,
      End: max - committed.current,
    }
    const delta = steps[event.key]
    if (delta === undefined) return
    event.preventDefault()
    stepBy(delta)
  }

  // The wheel turns the knob only once it has focus, so scrolling past never changes it.
  const wheel = useRef({ step, stepBy })
  wheel.current = { step, stepBy }
  useEffect(() => {
    const knob = knobRef.current
    if (!knob) return
    let accumulated = 0
    const onWheel = (event: WheelEvent) => {
      if (document.activeElement !== knob) return
      event.preventDefault()
      accumulated += event.deltaY
      while (Math.abs(accumulated) >= 40) {
        const sign = Math.sign(accumulated)
        accumulated -= sign * 40
        wheel.current.stepBy(-sign * wheel.current.step)
      }
    }
    knob.addEventListener("wheel", onWheel, { passive: false })
    return () => knob.removeEventListener("wheel", onWheel)
  }, [])

  const center = size / 2
  const tickCount = Math.max(1, Math.round(range / step))
  const activeTick = Math.round(((value - min) / (range || 1)) * tickCount)
  const knobSize = size * 0.7
  const outer = size / 2 - 3

  const tickLength = (i: number, indicatorAngle: number) => {
    const angle = START_ANGLE + (i / tickCount) * SWEEP
    const base = i === 0 || i === tickCount ? 9 : 6
    const distance = (angle - indicatorAngle) / WAVE_WIDTH
    return Math.round((base + WAVE_HEIGHT * Math.exp(-distance * distance)) * 10) / 10
  }
  const tickGeometry = (i: number, length: number) => {
    const angle = START_ANGLE + (i / tickCount) * SWEEP
    return {
      a: polar(center, center, outer - length, angle),
      b: polar(center, center, outer, angle),
    }
  }

  // Written straight to the lines each frame: no re-render while turning.
  useMotionValueEvent(rotation, "change", (indicatorAngle) => {
    for (let i = 0; i <= tickCount; i++) {
      const line = tickRefs.current[i]
      const length = tickLength(i, indicatorAngle)
      if (!line || tickLengths.current[i] === length) continue
      tickLengths.current[i] = length
      const { a } = tickGeometry(i, length)
      line.setAttribute("x1", String(a.x))
      line.setAttribute("y1", String(a.y))
    }
  })

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative select-none" style={{ width: size, height: size }}>
        <svg
          aria-hidden
          className="absolute inset-0"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {Array.from({ length: tickCount + 1 }, (_, i) => {
            const length = tickLength(i, rotation.get())
            tickLengths.current[i] = length
            const { a, b } = tickGeometry(i, length)
            const lit = i <= activeTick
            return (
              <line
                // biome-ignore lint/suspicious/noArrayIndexKey: ticks are positional
                key={i}
                ref={(node) => {
                  tickRefs.current[i] = node
                }}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                strokeLinecap="round"
                strokeWidth={i === activeTick ? 2.5 : 1.75}
                className="transition-[stroke] duration-150"
                style={{
                  stroke:
                    i === activeTick
                      ? "var(--color-aura-1)"
                      : lit
                        ? "rgb(255 255 255 / 0.9)"
                        : "rgb(255 255 255 / 0.18)",
                }}
              />
            )
          })}
        </svg>
        <div
          ref={knobRef}
          role="slider"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onDoubleClick={() => {
            pointerType.current = "mouse"
            settleTo(clamp(defaultValue, min, max))
          }}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 touch-none overflow-hidden rounded-full bg-white/10 shadow-float ring-1 ring-white/15 outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            grabbing ? "cursor-grabbing" : "cursor-grab",
          )}
          style={{ width: knobSize, height: knobSize }}
        >
          {image ? (
            // biome-ignore lint/performance/noImgElement: remote artwork as the knob's face
            <img
              src={image}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 size-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-black/45" />
          <motion.div aria-hidden className="absolute inset-0" style={{ rotate: rotation }}>
            <span className="absolute top-1.5 left-1/2 h-2.5 w-[3px] -translate-x-1/2 rounded-full bg-white shadow" />
          </motion.div>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Rolling
              text={String(value)}
              direction={direction}
              reduceMotion={Boolean(reduceMotion)}
            />
          </div>
        </div>
      </div>
      <span
        id={labelId}
        className="max-w-full truncate text-center text-[12px] font-semibold text-white/85"
      >
        {label}
      </span>
    </div>
  )
}

const roll: Variants = {
  enter: (offset: number) => ({
    opacity: 0,
    transform: `translateY(${offset}px)`,
    filter: offset === 0 ? "blur(0px)" : "blur(2px)",
  }),
  center: { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
  exit: (offset: number) => ({
    opacity: 0,
    transform: `translateY(${-offset}px)`,
    filter: offset === 0 ? "blur(0px)" : "blur(2px)",
  }),
}

/** Each digit rolls on its own, so only the ones that changed move. */
function Rolling({
  text,
  direction,
  reduceMotion,
}: {
  text: string
  direction: 1 | -1
  reduceMotion: boolean
}) {
  const offset = reduceMotion ? 0 : direction * 10
  return (
    <span
      aria-hidden
      className="font-title relative flex text-[26px] text-white tabular-nums drop-shadow"
    >
      {text.split("").map((char, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: digits are positional
        <span key={index} className="relative inline-flex overflow-hidden">
          <AnimatePresence custom={offset} initial={false} mode="popLayout">
            <motion.span
              key={char}
              custom={offset}
              variants={roll}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.16, ease: EASE_OUT }}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}
