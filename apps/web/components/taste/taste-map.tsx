"use client"

import type { StoredPick } from "@najimi/db/schema"
import { cn } from "@najimi/ui/lib/utils"
import { useTranslations } from "next-intl"
import { createRef, type RefObject, useMemo, useRef } from "react"
import { AnimatedBeam } from "./animated-beam"
import { Face } from "./face"

/*
 * "What your taste connects", drawn: the loves that drove Qloo's answers on the left, you in the
 * middle, what they led to on the right, with a light running love → you → pick. The same lines
 * Qloo's explainability gives ("Insecure led to Jorja Smith"), made visible.
 */

type Bridge = { from: string; to: string; domain: string }
type Love = { name: string; imageUrl: string | null }
type Node = { name: string; image: string | null; ref: RefObject<HTMLDivElement | null> }

/** The light that runs along each line: the signal, because the map is the run's result made visible. */
const SIGNAL = "#D7FF3D"

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function TasteMap({
  person,
  loves,
  bridges,
  picks,
}: {
  person: { name: string; look: string | null }
  loves: Love[]
  bridges: Bridge[]
  picks: Record<string, StoredPick[]>
}) {
  const t = useTranslations("Taste")
  const td = useTranslations("Domains")
  const box = useRef<HTMLDivElement>(null)
  const you = useRef<HTMLDivElement>(null)

  // Up to four connections; each love and each pick shows once, with its artwork.
  const { left, right, links } = useMemo(() => {
    const left: Node[] = []
    const right: (Node & { domain: string })[] = []
    const links: { from: number; to: number }[] = []
    for (const b of bridges.slice(0, 4)) {
      let from = left.findIndex((n) => same(n.name, b.from))
      if (from < 0) {
        const love = loves.find((l) => same(l.name, b.from))
        left.push({ name: b.from, image: love?.imageUrl ?? null, ref: createRef() })
        from = left.length - 1
      }
      const pick = picks[b.domain]?.find((p) => same(p.name, b.to))
      right.push({ name: b.to, image: pick?.image ?? null, domain: b.domain, ref: createRef() })
      links.push({ from, to: right.length - 1 })
    }
    return { left, right, links }
  }, [bridges, loves, picks])

  if (!links.length) return null

  const dot = (n: Node, size: string) => (
    <div
      ref={n.ref}
      className={cn(
        "relative z-10 overflow-hidden rounded-full bg-raised ring-2 ring-background",
        size,
      )}
    >
      {n.image ? (
        // biome-ignore lint/performance/noImgElement: Qloo artwork from its own CDN
        <img src={n.image} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="grid size-full place-items-center bg-raised text-xs font-medium text-text-2">
          {n.name.slice(0, 2)}
        </span>
      )}
    </div>
  )

  return (
    <section className="flex flex-col gap-3">
      <p className="text-[11px] font-medium tracking-[0.08em] text-text-3 uppercase">
        {t("bridges")}
      </p>
      <div
        ref={box}
        className="relative flex items-center justify-between gap-2 py-2 text-foreground"
      >
        {links.map((l, i) => (
          <span key={`${l.from}-${l.to}`} className="contents">
            <AnimatedBeam
              containerRef={box}
              fromRef={left[l.from]?.ref ?? you}
              toRef={you}
              curvature={(i - (links.length - 1) / 2) * -18}
              delay={i * 0.6}
              duration={3.6}
              pathColor="currentColor"
              pathWidth={1.5}
              pathOpacity={0.14}
              gradientStartColor={SIGNAL}
              gradientStopColor={SIGNAL}
            />
            <AnimatedBeam
              containerRef={box}
              fromRef={you}
              toRef={right[l.to]?.ref ?? you}
              curvature={(i - (links.length - 1) / 2) * 18}
              delay={i * 0.6 + 0.9}
              duration={3.6}
              pathColor="currentColor"
              pathWidth={1.5}
              pathOpacity={0.14}
              gradientStartColor={SIGNAL}
              gradientStopColor={SIGNAL}
            />
          </span>
        ))}

        <ul className="flex flex-col gap-4">
          {left.map((n) => (
            <li key={n.name} className="flex w-16 flex-col items-center gap-1 text-center">
              {dot(n, "size-12")}
              <span className="w-full truncate text-[11px] font-semibold">{n.name}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-center gap-1">
          <div ref={you} className="relative z-10">
            <Face look={person.look} name={person.name} size="lg" />
          </div>
          <span className="text-[11px] font-semibold">{t("you")}</span>
        </div>

        <ul className="flex flex-col gap-3">
          {right.map((n) => (
            <li
              key={`${n.domain}-${n.name}`}
              className="flex w-20 flex-col items-center gap-1 text-center"
            >
              {dot(n, "size-11")}
              <span className="w-full truncate text-[11px] font-semibold">{n.name}</span>
              <span className="-mt-1 text-[10px] text-paper-muted">{td(n.domain as "artist")}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* The same connections in words, for screen readers and for a quick read. */}
      <ul className="sr-only">
        {bridges.slice(0, 4).map((b) => (
          <li key={`${b.domain}-${b.to}`}>
            {td(b.domain as "artist")}: {t("bridged", { from: b.from, to: b.to })}
          </li>
        ))}
      </ul>
    </section>
  )
}
