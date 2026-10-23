"use client"

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from "motion/react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"

/*
 * The landing's hero: real things people love (Qloo's own artwork) gather from everywhere into a
 * line, then a ring around the promise; scrolling bends the ring into an arc that lifts away. It's
 * driven by the page's own scroll (a sticky section) instead of capturing the wheel, so phones
 * scroll normally.
 */

type Phase = "scatter" | "line" | "ring"
type Art = { src: string; name: string }

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t

/** A steady pseudo-random spread (the same on every render, no Math.random on the server). */
const spread = (i: number) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return { x: (r(1) - 0.5) * 1600, y: (r(2) - 0.5) * 1100, rotate: (r(3) - 0.5) * 160 }
}

export function TasteRing({ art, children }: { art: Art[]; children: ReactNode }) {
  const still = useReducedMotion()
  const section = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 390, h: 800 })
  const [phase, setPhase] = useState<Phase>(still ? "ring" : "scatter")
  const [morph, setMorph] = useState(0)
  /** 0 → 1 over the hero's last stretch: the arc and the words leave together. */
  const [fade, setFade] = useState(0)
  // The cards fly in on the client only (their start is a spread the server needn't draw).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!stage.current) return
    const watch = new ResizeObserver(([e]) => {
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    watch.observe(stage.current)
    return () => watch.disconnect()
  }, [])
  useEffect(() => {
    if (still) return
    const a = setTimeout(() => setPhase("line"), 300)
    const b = setTimeout(() => setPhase("ring"), 1700)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [still])

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] })
  const smooth = useSpring(scrollYProgress, { stiffness: 60, damping: 22 })
  useMotionValueEvent(smooth, "change", (v) => {
    setMorph(Math.min(1, v * 1.4))
    setFade(Math.min(1, Math.max(0, (v - 0.72) / 0.28)))
  })

  const n = art.length
  const mobile = size.w < 768
  const card = mobile ? { w: 54, h: 76 } : { w: 74, h: 104 }
  const targets = useMemo(
    () =>
      art.map((_, i) => {
        if (phase === "scatter") return { ...spread(i), scale: 0.6, opacity: 0 }
        if (phase === "line") {
          const gap = card.w + 8
          return { x: i * gap - (n * gap) / 2, y: 0, rotate: 0, scale: 1, opacity: 1 }
        }
        // An oval that frames the words: tall on a phone, wide on a screen.
        const rx = mobile ? size.w * 0.42 : Math.min(size.w * 0.36, 440)
        const ry = mobile ? size.h * 0.35 : Math.min(size.h * 0.4, 340)
        const a = (i / n) * Math.PI * 2 - Math.PI / 2
        const ring = { x: Math.cos(a) * rx, y: Math.sin(a) * ry, rotate: (a * 180) / Math.PI + 90 }
        // The arc: a wide bow below the words, lifting as the page scrolls on.
        const arcR = Math.max(size.w, size.h) * (mobile ? 1.2 : 1.05)
        const bow = mobile ? 96 : 120
        const ang = (-90 - bow / 2 + (i * bow) / Math.max(n - 1, 1)) * (Math.PI / 180)
        const arc = {
          x: Math.cos(ang) * arcR,
          y: Math.sin(ang) * arcR + arcR + size.h * 0.18,
          rotate: (ang * 180) / Math.PI + 90,
        }
        return {
          x: lerp(ring.x, arc.x, morph),
          y: lerp(ring.y, arc.y, morph),
          rotate: lerp(ring.rotate, arc.rotate, morph),
          scale: lerp(1, mobile ? 1.25 : 1.5, morph),
          opacity: 1 - fade,
        }
      }),
    [art, phase, size, morph, fade, mobile, n, card.w],
  )

  return (
    <div ref={section} className="relative h-[190svh]">
      <div ref={stage} className="sticky top-0 h-svh overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--color-aura-2) 0%, var(--color-aura-1) 40%, transparent 70%)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {(mounted ? art : []).map((a, i) => (
            <motion.div
              key={a.src}
              className="absolute overflow-hidden rounded-[14px] bg-card shadow-float ring-1 ring-white/10"
              style={{ width: card.w, height: card.h }}
              initial={false}
              animate={targets[i]}
              transition={
                still
                  ? { duration: 0 }
                  : { type: "spring", stiffness: phase === "ring" ? 70 : 40, damping: 16 }
              }
            >
              {/* biome-ignore lint/performance/noImgElement: Qloo artwork */}
              <img src={a.src} alt={a.name} className="size-full object-cover" loading="eager" />
            </motion.div>
          ))}
        </div>
        <motion.div
          className="absolute inset-0 flex items-center justify-center px-6"
          animate={{
            opacity: phase === "ring" ? 1 - fade : 0,
            y: phase === "ring" ? -morph * size.h * 0.08 : 16,
          }}
          transition={{ duration: still ? 0 : 0.6 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
