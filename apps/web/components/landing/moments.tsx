"use client"

import { cn } from "@najimi/ui/lib/utils"
import { motion, useReducedMotion } from "motion/react"

/*
 * What Najimi is, shown rather than told: real screens from the app in a phone, a few words each,
 * and one detail lifted out of the screen beside it. After 21st.dev jahed/cinematic-landing-hero
 * (the phone with floating cards) and Refero's app-store style showcases.
 */

export type Moment = {
  id: string
  kicker: string
  title: string
  image: string
  chips: string[]
}

function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-[min(72vw,300px)] shrink-0 rounded-[46px] bg-[#111113] p-[9px] shadow-[0_40px_120px_-30px_rgba(139,92,255,0.45)] ring-1 ring-white/12">
      <div className="absolute top-[18px] left-1/2 z-10 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" />
      {/* biome-ignore lint/performance/noImgElement: a real screen from the app */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="aspect-[390/844] w-full rounded-[38px] object-cover object-top"
      />
    </div>
  )
}

export function Moments({ items }: { items: Moment[] }) {
  const still = useReducedMotion()
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-28 px-6 py-24 md:gap-40">
      {items.map((m, i) => (
        <motion.section
          key={m.id}
          initial={still ? false : { opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className={cn(
            "flex flex-col items-center gap-12 md:flex-row md:justify-between md:gap-16",
            i % 2 === 1 && "md:flex-row-reverse",
          )}
        >
          <div className="flex max-w-md flex-col items-center gap-4 text-center md:items-start md:text-start">
            <span className="text-[13px] font-bold tracking-[0.12em] text-signal uppercase">
              {m.kicker}
            </span>
            <h2 className="font-title text-[2.6rem] leading-[1.02] md:text-[3.6rem]">{m.title}</h2>
          </div>
          <div className="relative">
            <Phone src={m.image} alt={m.title} />
            {m.chips.map((chip, j) => (
              <motion.span
                key={chip}
                initial={still ? false : { opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + j * 0.15, type: "spring", bounce: 0.3 }}
                className={cn(
                  "absolute flex items-center gap-2 rounded-pill bg-black/70 px-4 py-2.5 text-[14px] font-semibold whitespace-nowrap text-white shadow-float ring-1 ring-white/15 backdrop-blur-xl",
                  j === 0 ? "top-[18%] -left-10 md:-left-24" : "bottom-[22%] -right-8 md:-right-20",
                )}
              >
                <span className="size-2 rounded-full bg-signal" />
                {chip}
              </motion.span>
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  )
}

/** The year in taste: three real story slides, fanned. */
export function WrappedFan({
  kicker,
  title,
  slides,
}: {
  kicker: string
  title: string
  slides: string[]
}) {
  const still = useReducedMotion()
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-14 px-6 pb-28">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-[13px] font-bold tracking-[0.12em] text-signal uppercase">
          {kicker}
        </span>
        <h2 className="font-title text-[2.6rem] leading-[1.02] md:text-[3.6rem]">{title}</h2>
      </div>
      <div className="relative flex h-[min(110vw,520px)] w-full items-center justify-center">
        {slides.map((src, i) => {
          const off = i - (slides.length - 1) / 2
          return (
            // biome-ignore lint/performance/noImgElement: our own story slides, already sized
            <motion.img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              initial={still ? false : { opacity: 0, y: 80, rotate: 0 }}
              whileInView={{
                opacity: 1,
                y: Math.abs(off) * 24,
                rotate: off * 9,
                x: `${off * 62}%`,
              }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 70, damping: 16 }}
              className="absolute aspect-[9/16] w-[min(42vw,230px)] rounded-[22px] object-cover shadow-float ring-1 ring-white/10"
              style={{ zIndex: 10 - Math.abs(off) }}
            />
          )
        })}
      </div>
    </section>
  )
}
