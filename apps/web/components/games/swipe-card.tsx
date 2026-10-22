"use client"

import { cn } from "@najimi/ui/lib/utils"
import {
  animate,
  motion,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { type KeyboardEvent, type ReactNode, useRef } from "react"

/*
 * Blind Taste's deck: swipe right if you'd love it, left if it's not for you, up for maybe (the
 * buttons and the arrow keys do the same). The stamp grows as you pull; a long pull or a quick
 * flick throws the card off the deck, and the next ones wait underneath. After the Swipe Deck
 * (21st.dev ddoemonn/swipe-deck, MIT): its distance-or-flick release, keyboard arrows and leave
 * curve; made three-way here, with no undo (an answer is kept the moment it's given).
 */

const THROW = 110
const FLICK = 520
const LEAVE = [0.4, 0, 1, 1] as const

export type BlindAnswer = 0 | 1 | 2

export type SwipeHandle = { fling: (answer: BlindAnswer) => void }

export function SwipeDeck({
  image,
  behind,
  children,
  onAnswer,
  stamps,
  disabled = false,
  handle,
}: {
  image: string | null
  /** The next cards' artwork, peeking under this one. */
  behind: (string | null)[]
  children: ReactNode
  onAnswer: (answer: BlindAnswer) => void
  stamps: { love: string; maybe: string; no: string }
  disabled?: boolean
  /** Lets the buttons throw the card the same way a swipe does. */
  handle?: (h: SwipeHandle) => void
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const still = useReducedMotion()
  const rotate = useTransform(x, [-240, 240], [-16, 16])
  const love = useTransform(x, [24, THROW], [0, 1])
  const no = useTransform(x, [-THROW, -24], [1, 0])
  const maybe = useTransform(y, [-THROW, -24], [1, 0])
  const gone = useRef(false)

  const fling = (answer: BlindAnswer) => {
    if (disabled || gone.current) return
    gone.current = true
    if ("vibrate" in navigator) navigator.vibrate(8)
    const to =
      answer === 2 ? { x: 640, y: 60 } : answer === 0 ? { x: -640, y: 60 } : { x: 0, y: -760 }
    // The answer goes once: when the card has left, or after a beat if the animation can't run
    // (a background tab pauses it).
    let sent = false
    const send = () => {
      if (sent) return
      sent = true
      onAnswer(answer)
    }
    if (still) return send()
    void Promise.all([
      animate(x, to.x, { duration: 0.34, ease: LEAVE }),
      animate(y, to.y, { duration: 0.34, ease: LEAVE }),
    ]).then(send)
    setTimeout(send, 420)
  }
  handle?.({ fling })

  const end = (_: unknown, info: PanInfo) => {
    const { x: dx, y: dy } = info.offset
    const { x: vx, y: vy } = info.velocity
    const up = dy < -THROW || (vy < -FLICK && dy < -THROW * 0.35)
    if (up && Math.abs(dx) < THROW) return fling(1)
    if (dx > THROW || (vx > FLICK && dx > THROW * 0.35)) return fling(2)
    if (dx < -THROW || (vx < -FLICK && dx < -THROW * 0.35)) return fling(0)
  }

  const key = (event: KeyboardEvent) => {
    const answer =
      event.key === "ArrowRight"
        ? 2
        : event.key === "ArrowLeft"
          ? 0
          : event.key === "ArrowUp"
            ? 1
            : null
    if (answer === null) return
    event.preventDefault()
    fling(answer)
  }

  return (
    <div className="relative aspect-[4/5] w-full max-w-[300px]">
      {behind.slice(0, 2).map((src, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: the cards under the top one, by depth
          key={`${i}-${src}`}
          aria-hidden
          className="absolute inset-0 overflow-hidden rounded-sheet bg-raised shadow-float"
          style={{
            transform: `translateY(${(i + 1) * 14}px) scale(${1 - (i + 1) * 0.06})`,
            zIndex: 2 - i,
            opacity: 1 - (i + 1) * 0.3,
          }}
        >
          {src ? (
            // biome-ignore lint/performance/noImgElement: remote artwork
            <img src={src} alt="" className="size-full object-cover blur-[2px]" />
          ) : null}
        </div>
      ))}
      <motion.div
        tabIndex={disabled ? -1 : 0}
        role="group"
        aria-roledescription="card deck"
        onKeyDown={key}
        drag={!disabled}
        dragSnapToOrigin
        dragElastic={0.75}
        onDragEnd={end}
        style={{ x, y, rotate, zIndex: 5 }}
        whileTap={disabled ? undefined : { scale: 0.985 }}
        className={cn(
          "absolute inset-0 overflow-hidden rounded-sheet bg-raised shadow-float outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-signal",
          disabled ? "" : "cursor-grab touch-none active:cursor-grabbing",
        )}
      >
        {image ? (
          // biome-ignore lint/performance/noImgElement: remote artwork
          <img
            src={image}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <motion.span
          style={{ opacity: love }}
          className="absolute top-6 start-5 -rotate-12 rounded-tag border-[3px] border-success px-3 py-1 font-title text-[26px] text-success"
        >
          {stamps.love}
        </motion.span>
        <motion.span
          style={{ opacity: no }}
          className="absolute top-6 end-5 rotate-12 rounded-tag border-[3px] border-danger px-3 py-1 font-title text-[26px] text-danger"
        >
          {stamps.no}
        </motion.span>
        <motion.span
          style={{ opacity: maybe }}
          className="absolute inset-x-0 top-1/3 mx-auto w-fit rounded-tag border-[3px] border-warn px-3 py-1 font-title text-[26px] text-warn"
        >
          {stamps.maybe}
        </motion.span>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">{children}</div>
      </motion.div>
    </div>
  )
}
