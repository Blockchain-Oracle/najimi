"use client"

import { ArrowRight, X } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

/*
 * A shared Wrapped, played like a story: one slide at a time, a bar per slide across the top
 * filling as it plays, tap right for the next and left for the one before, hold to pause.
 */

const SLIDE_MS = 5200

export function StoryViewer({
  token,
  slides,
  start,
}: {
  token: string
  slides: number
  start: number
}) {
  const t = useTranslations("Passport")
  const [n, setN] = useState(Math.min(Math.max(start, 1), slides))
  const [paused, setPaused] = useState(false)
  const [k, setK] = useState(0)
  const go = useCallback(
    (next: number) => {
      setN(Math.min(Math.max(next, 1), slides))
      setK(0)
    },
    [slides],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: k resumes where a pause left off
  useEffect(() => {
    if (paused) return
    const startAt = performance.now() - k * SLIDE_MS
    let raf = 0
    const step = (now: number) => {
      const p = (now - startAt) / SLIDE_MS
      if (p >= 1) {
        if (n < slides) go(n + 1)
        else setK(1)
        return
      }
      setK(p)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [n, paused, slides, go])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="relative aspect-[9/16] h-full max-h-dvh w-auto max-w-full select-none">
        {/* biome-ignore lint/performance/noImgElement: our own generated story slide */}
        <img
          src={`/api/og/wrapped/${token}/${n}`}
          alt={t("slide", { n })}
          className="size-full object-contain"
          draggable={false}
        />
        <div className="absolute inset-x-3 top-3 flex gap-1.5">
          {Array.from({ length: slides }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: one bar per slide, by position
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full bg-white"
                style={{ width: `${i + 1 < n ? 100 : i + 1 === n ? k * 100 : 0}%` }}
              />
            </span>
          ))}
        </div>
        <button
          type="button"
          aria-label={t("previous")}
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={() => go(n - 1)}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        />
        <button
          type="button"
          aria-label={t("next")}
          className="absolute inset-y-0 right-0 w-2/3"
          onClick={() => go(n + 1)}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        />
        <Link
          href="/"
          aria-label={t("close")}
          className="absolute top-7 right-3 grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
        >
          <X className="size-5" />
        </Link>
        {n === slides ? (
          <Link
            href="/start"
            className="absolute inset-x-6 bottom-[16%] flex h-14 items-center justify-center gap-2 rounded-pill bg-white font-heading text-[16px] text-black"
          >
            {t("yourOwn")} <ArrowRight className="size-5" />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
