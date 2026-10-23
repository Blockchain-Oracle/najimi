"use client"

import { Orb } from "@najimi/ui/components/orb"
import { cn } from "@najimi/ui/lib/utils"
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { MILESTONES, PITCH, PROBLEM, STEPS } from "@/app/[locale]/pitch/copy"

/*
 * The pitch as full-screen slides: arrow keys, space, Page Up/Down, Home/End, the dots or a swipe
 * move between them; themes alternate dark and light. Every word lives in pitch/copy.ts.
 */

type Theme = (typeof PITCH)[number]["theme"]

/** Each theme's colours (the app's own dark and light tokens). */
const THEME: Record<
  Theme,
  { page: string; muted: string; rule: string; panel: string; solid: string }
> = {
  dark: {
    page: "bg-black text-[#F5F5F7]",
    muted: "text-white/60",
    rule: "border-white/10",
    panel: "bg-[#131315] ring-white/10",
    solid: "bg-[#F5F5F7] text-black",
  },
  light: {
    page: "bg-white text-[#0B0B0D]",
    muted: "text-black/55",
    rule: "border-black/10",
    panel: "bg-[#F4F4F6] ring-black/8",
    solid: "bg-[#0B0B0D] text-white",
  },
}

export function PitchDeck() {
  const [index, setIndex] = useState(0)
  const slide = PITCH[index] ?? PITCH[0]
  const look = THEME[slide.theme]
  const last = PITCH.length - 1
  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(last, next))), [last])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select"))
        return
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault()
        setIndex((i) => Math.min(last, i + 1))
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (event.key === "Home") setIndex(0)
      else if (event.key === "End") setIndex(last)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [last])

  // A sideways swipe on a phone turns the page.
  const touch = useRef<number | null>(null)

  return (
    <main
      className={cn(
        "fixed inset-0 z-[90] overflow-hidden transition-colors duration-300",
        look.page,
      )}
      aria-label="Najimi pitch"
      onTouchStart={(e) => {
        touch.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const from = touch.current
        const to = e.changedTouches[0]?.clientX
        touch.current = null
        if (from == null || to == null || Math.abs(to - from) < 60) return
        go(index + (to < from ? 1 : -1))
      }}
    >
      {slide.theme === "dark" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(45% 40% at 15% 20%, color-mix(in oklab, var(--color-aura-1) 30%, transparent), transparent 70%), radial-gradient(40% 40% at 85% 85%, color-mix(in oklab, var(--color-aura-2) 24%, transparent), transparent 70%)",
          }}
        />
      ) : null}
      <div className="relative mx-auto flex h-dvh w-full max-w-6xl flex-col px-5 md:px-10">
        <header
          className={cn(
            "flex h-16 shrink-0 items-center justify-between gap-4 border-b",
            look.rule,
          )}
        >
          <Link href="/" className="font-title text-[22px] leading-none" aria-label="Najimi home">
            najimi
          </Link>
          <div className="flex items-center gap-4 text-[13px]">
            <Link
              href="/demo"
              className="inline-flex items-center gap-1 font-semibold hover:underline"
            >
              Demo <ArrowUpRight className="size-3.5" />
            </Link>
            <span className={cn("tnum hidden sm:inline", look.muted)}>
              {String(index + 1).padStart(2, "0")} / {String(PITCH.length).padStart(2, "0")} ·{" "}
              {slide.label}
            </span>
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto py-8 md:py-12" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.article
              key={slide.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "grid h-full items-center gap-10",
                // The diagram needs the whole width; every other slide sits words beside picture.
                slide.id === "how" ? "content-center" : "md:grid-cols-[1.05fr_1fr]",
              )}
              aria-label={`Slide ${index + 1}: ${slide.label}`}
            >
              <div className="flex flex-col gap-5">
                <p className={cn("text-[12px] font-bold tracking-[0.12em] uppercase", look.muted)}>
                  {slide.eyebrow}
                </p>
                <h1 className="font-title text-[2.6rem] leading-[1.02] tracking-[-0.02em] md:text-[4.2rem]">
                  {slide.title}
                </h1>
                <p
                  className={cn("max-w-xl text-[17px] leading-relaxed md:text-[19px]", look.muted)}
                >
                  {slide.body}
                </p>
                {slide.id === "start" ? (
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Link
                      href="/demo"
                      className={cn(
                        "inline-flex h-12 items-center gap-2 rounded-pill px-6 font-heading text-[15px]",
                        look.solid,
                      )}
                    >
                      Open the demo <ArrowUpRight className="size-4" />
                    </Link>
                    <Link
                      href="/start"
                      className={cn(
                        "inline-flex h-12 items-center rounded-pill px-6 font-heading text-[15px] ring-1",
                        look.rule.replace("border", "ring"),
                      )}
                    >
                      Try it now
                    </Link>
                  </div>
                ) : null}
              </div>

              <Visual id={slide.id} look={look} />
            </motion.article>
          </AnimatePresence>
        </section>

        <footer
          className={cn(
            "flex h-16 shrink-0 items-center justify-between gap-4 border-t",
            look.rule,
          )}
        >
          <span className={cn("hidden text-[12px] sm:inline", look.muted)}>
            ← → or space to move
          </span>
          <nav className="flex items-center gap-2" aria-label="Pitch slides">
            {PITCH.map((item, dot) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(dot)}
                aria-label={`Go to slide ${dot + 1}: ${item.label}`}
                aria-current={dot === index ? "step" : undefined}
                className={cn(
                  "h-2 rounded-full transition-all",
                  dot === index ? "w-6 bg-current" : "w-2 bg-current opacity-30 hover:opacity-60",
                )}
              />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label="Previous slide"
              className={cn(
                "grid size-10 place-items-center rounded-full ring-1 disabled:opacity-30",
                look.rule.replace("border", "ring"),
              )}
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === last}
              aria-label="Next slide"
              className={cn(
                "grid size-10 place-items-center rounded-full disabled:opacity-30",
                look.solid,
              )}
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </footer>
      </div>
    </main>
  )
}

/** What each slide shows beside its words. */
function Visual({ id, look }: { id: (typeof PITCH)[number]["id"]; look: (typeof THEME)[Theme] }) {
  if (id === "start")
    return (
      <figure className="mx-auto w-full max-w-[18rem]">
        <div className="overflow-hidden rounded-[2.2rem] p-2 shadow-2xl ring-1 ring-white/15">
          <Image
            src="/demo/group-fit-phone.webp"
            alt="A circle chat where Najimi answers with three places, each scored for Juno and for Kemi"
            width={780}
            height={1688}
            priority
            className="h-auto w-full rounded-[1.8rem]"
          />
        </div>
        <figcaption className={cn("pt-3 text-center text-[12px]", look.muted)}>
          The live app · a circle asks Najimi
        </figcaption>
      </figure>
    )
  if (id === "problem")
    return (
      <ol className="flex flex-col gap-3">
        {PROBLEM.map((line) => (
          <li
            key={line}
            className={cn("rounded-card px-6 py-5 font-heading text-[19px] ring-1", look.panel)}
          >
            {line}
          </li>
        ))}
      </ol>
    )
  if (id === "product")
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 pb-2">
          <Orb size={44} working />
          <span className={cn("text-[14px]", look.muted)}>"Najimi, find us a spot tonight."</span>
        </div>
        {STEPS.map((s) => (
          <div
            key={s.label}
            className={cn("flex flex-col gap-1 rounded-card px-6 py-5 ring-1", look.panel)}
          >
            <span className={cn("text-[12px] font-bold tracking-[0.1em] uppercase", look.muted)}>
              {s.label}
            </span>
            <strong className="font-heading text-[18px] font-normal">{s.text}</strong>
          </div>
        ))}
      </div>
    )
  if (id === "how")
    return (
      <figure className={cn("overflow-hidden rounded-card p-4 ring-1", look.panel)}>
        <Image
          src="/pitch/group-turn-light.webp"
          alt="One ask, step by step: Juno asks in the circle, Najimi asks Qloo for places for both loves, scores the same five against each person's taste, and the card reaches Juno and Kemi live"
          width={1568}
          height={476}
          className="h-auto w-full"
        />
      </figure>
    )
  return (
    <ol className="flex flex-col gap-3">
      {MILESTONES.map((m) => (
        <li
          key={m.label}
          className={cn("flex flex-col gap-1 rounded-card px-6 py-5 ring-1", look.panel)}
        >
          <span className={cn("text-[12px] font-bold tracking-[0.1em] uppercase", look.muted)}>
            {m.label}
          </span>
          <strong className="font-heading text-[18px] font-normal">{m.text}</strong>
        </li>
      ))}
    </ol>
  )
}
