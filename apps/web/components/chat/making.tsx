"use client"

import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { TextShimmer } from "./text-shimmer"

/*
 * An image being made. A restyle starts from your own photo, so it shows that photo blurred with a
 * band of clarity sweeping down it while the model works; a new image shows the taste's colours
 * drifting. The words it's being made from go by underneath.
 */

/** How long an image usually takes; the sweep slows near the end and waits for the real one. */
const TYPICAL_MS = 18_000

export function Making({
  before,
  label,
  words,
}: {
  before?: string | null
  label: string
  words: string[]
}) {
  const [progress, setProgress] = useState(0)
  const [word, setWord] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => {
      const share = (Date.now() - started) / TYPICAL_MS
      // Eases towards 92% and holds: the real image ends it.
      setProgress(92 * (1 - Math.exp(-2.2 * share)))
    }, 60)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (words.length < 2) return
    const timer = setInterval(() => setWord((w) => (w + 1) % words.length), 1600)
    return () => clearInterval(timer)
  }, [words.length])

  const mask = `linear-gradient(to bottom, transparent ${Math.max(progress - 6, 0)}%, black ${progress + 6}%)`

  return (
    <div className="relative aspect-[3/2] overflow-hidden rounded-tile bg-ash">
      {before ? (
        <>
          {/* biome-ignore lint/performance/noImgElement: the person's own photo, session-checked */}
          <img
            src={before}
            alt=""
            className="absolute inset-0 size-full object-cover saturate-50"
          />
          <div
            className="absolute inset-0 backdrop-blur-2xl"
            style={{ maskImage: mask, WebkitMaskImage: mask }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-white/25 to-transparent mix-blend-screen"
            style={{ top: `calc(${progress}% - 1.25rem)` }}
          />
        </>
      ) : (
        <div className="absolute inset-0">
          {["bg-white/10", "bg-white/6", "bg-white/8"].map((tone, i) => (
            <motion.span
              key={tone}
              className={`absolute size-2/3 rounded-full blur-3xl ${tone}`}
              animate={{ x: ["-10%", "40%", "0%"], y: ["0%", "30%", "-10%"] }}
              transition={{
                duration: 7 + i * 2,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
              style={{ left: `${i * 25}%`, top: `${(i % 2) * 30}%` }}
            />
          ))}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
        <TextShimmer className="text-sm font-semibold">{label}</TextShimmer>
        {words.length ? (
          <motion.span
            key={word}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-pill bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
          >
            {words[word]}
          </motion.span>
        ) : null}
      </div>
    </div>
  )
}
