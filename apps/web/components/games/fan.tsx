"use client"

import { cn } from "@najimi/ui/lib/utils"
import { motion, useReducedMotion } from "motion/react"

/*
 * A hand of cards: the round's things fanned out, face up (the answers stay hidden). Adapted from
 * the Card Fan Carousel (21st.dev aayush-duhan/card-fan-carousel, MIT): the fan maths (each card's
 * turn, scale, spread and drop by its distance from the middle). Changed here: motion instead of
 * GSAP, no paging (a round is five), cards deal in from below, a mark per card once it's played.
 */

export type FanCard = { key: string; image: string | null; label: string; mark?: string | null }

function slot(count: number, i: number) {
  const center = (count - 1) / 2
  const d = count > 1 ? (i - center) / center : 0
  const a = Math.abs(d)
  return {
    rot: d * 18,
    scale: 1 - 0.18 * a * a,
    x: d * 46,
    y: a * a * 10,
    z: 10 - Math.round(a * 4),
  }
}

const SIZE = {
  lg: { box: "h-56", card: "top-2 -ms-[4.5rem] h-48 w-36" },
  sm: { box: "h-40", card: "top-1 -ms-12 h-32 w-24" },
} as const

export function Fan({
  cards,
  size = "lg",
  className,
}: {
  cards: FanCard[]
  size?: keyof typeof SIZE
  className?: string
}) {
  const still = useReducedMotion()
  return (
    <div className={cn("relative w-full", SIZE[size].box, className)} aria-hidden>
      {cards.map((card, i) => {
        const s = slot(cards.length, i)
        return (
          <motion.div
            key={card.key}
            initial={still ? false : { y: 160, opacity: 0, rotate: 0, scale: 0.8 }}
            animate={{ x: `${s.x}%`, y: s.y, rotate: s.rot, scale: s.scale, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.06 * i }}
            style={{ zIndex: s.z, originY: 1.4 }}
            className={cn(
              "absolute start-1/2 overflow-hidden rounded-card bg-raised shadow-float ring-1 ring-white/10",
              SIZE[size].card,
            )}
          >
            {card.image ? (
              // biome-ignore lint/performance/noImgElement: remote artwork
              <img src={card.image} alt="" className="size-full object-cover" draggable={false} />
            ) : (
              <span className="grid size-full place-items-center p-3 text-center font-heading text-[13px]">
                {card.label}
              </span>
            )}
            {card.mark ? (
              <span className="absolute inset-x-2 bottom-2 rounded-pill bg-black/70 py-0.5 text-center text-[12px] font-bold text-white backdrop-blur">
                {card.mark}
              </span>
            ) : null}
          </motion.div>
        )
      })}
    </div>
  )
}
