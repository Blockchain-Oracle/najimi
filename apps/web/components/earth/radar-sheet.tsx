"use client"

import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { ProfileLink } from "@/components/people/profile-link"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"

/*
 * The taste-twin radar (W10): you in the middle, a beam sweeping round, and your people placed by
 * how close their taste is — app people on the inner rings (the most loves and picks in common
 * nearest), the public figures Qloo predicts for you on the outer ring. Adapted from Aceternity's
 * Radar Effect (21st.dev manuarora700/radar-effect): the concentric rings and the rotating sweep.
 * Changed here: one accent, people instead of icons, placed by match, motion/react.
 */

type Radar = {
  twins: {
    userId: string
    name: string
    username: string | null
    look: string | null
    shared: number
  }[]
  figures: {
    id: string
    name: string
    image: string | null
    caption: string | null
    link: string | null
  }[]
}

const GOLDEN = 137.508

/** Where on the radar: angle spreads everyone round, radius is how far from you (0–1). */
const at = (i: number, r: number) => {
  const a = ((i * GOLDEN - 90) * Math.PI) / 180
  return { left: `${50 + Math.cos(a) * r * 46}%`, top: `${50 + Math.sin(a) * r * 46}%` }
}

export function RadarSheet({
  open,
  onOpenChange,
  me,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  me: { name: string; look: string | null }
}) {
  const t = useTranslations("Earth")
  const still = useReducedMotion()
  const radar = useQuery({
    queryKey: ["radar"],
    queryFn: () => api<Radar>("/api/people/radar"),
    enabled: open,
    staleTime: 5 * 60_000,
  })
  const twins = radar.data?.twins ?? []
  const best = Math.max(1, ...twins.map((x) => x.shared))
  const figures = (radar.data?.figures ?? []).slice(0, 8)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="dark max-h-[92svh] overflow-y-auto rounded-t-sheet border-0 bg-[#07060c] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground"
      >
        <SheetTitle className="font-title pt-5 text-[1.75rem] font-normal">
          {t("radarTitle")}
        </SheetTitle>
        <p className="text-[14px] text-text-3">{t("radarLine")}</p>

        <div className="relative mx-auto mt-4 aspect-square w-full max-w-[26rem]">
          {/* Rings. */}
          {[0.25, 0.5, 0.75, 1].map((r, i) => (
            <motion.span
              key={r}
              initial={still ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border rtl:translate-x-1/2"
              style={{
                width: `${r * 92}%`,
                height: `${r * 92}%`,
                borderColor: `rgba(255,255,255,${0.16 - i * 0.03})`,
              }}
            />
          ))}
          {/* The sweep. */}
          {still ? null : (
            <motion.span
              aria-hidden
              className="absolute inset-[4%] rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, color-mix(in oklab, var(--color-signal) 45%, transparent) 360deg)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
            />
          )}
          {/* You. */}
          <span className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-signal/40 rtl:translate-x-1/2">
            <Face look={me.look} name={me.name} size="lg" />
          </span>

          {/* People here, closest taste nearest. */}
          {twins.map((p, i) => {
            // Closer the more you share; ties spread out by rank so faces don't stack.
            const rank = twins.length > 1 ? i / (twins.length - 1) : 0
            const r = 0.3 + 0.4 * (0.5 * (1 - p.shared / best) + 0.5 * rank)
            return (
              <motion.span
                key={p.userId}
                initial={still ? false : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 + i * 0.07 }}
                className="absolute -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2"
                style={at(i, r)}
              >
                <ProfileLink username={p.username} className="flex flex-col items-center gap-1">
                  <span className="rounded-full ring-2 ring-white/80">
                    <Face look={p.look} name={p.name} size="sm" />
                  </span>
                  <span className="rounded-pill bg-black/70 px-1.5 text-[11px] font-semibold whitespace-nowrap">
                    {p.name}
                  </span>
                </ProfileLink>
              </motion.span>
            )
          })}

          {/* Public people Qloo predicts for you, on the outer ring. */}
          {figures.map((f, i) => (
            <motion.span
              key={f.id}
              initial={still ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.6 + i * 0.05 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2"
              style={at(i + 0.5, 0.9)}
            >
              <a
                href={f.link ?? undefined}
                target="_blank"
                rel="noreferrer"
                title={f.caption ? `${f.name} · ${f.caption}` : f.name}
                className={cn(
                  "block size-9 overflow-hidden rounded-full ring-2 ring-signal/70",
                  !f.link && "pointer-events-none",
                )}
              >
                {f.image ? (
                  // biome-ignore lint/performance/noImgElement: remote photo
                  <img src={f.image} alt={f.name} className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center bg-white/10 text-[12px] font-bold">
                    {f.name.slice(0, 1)}
                  </span>
                )}
              </a>
            </motion.span>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1">
          {twins.slice(0, 5).map((p) => (
            <ProfileLink
              key={p.userId}
              username={p.username}
              className="flex items-center gap-3 rounded-tile px-2 py-2 hover:bg-white/5"
            >
              <Face look={p.look} name={p.name} size="sm" />
              <span className="flex-1 text-[15px] font-semibold">{p.name}</span>
              <span className="text-[13px] text-text-3">{t("inCommon", { count: p.shared })}</span>
            </ProfileLink>
          ))}
          {radar.data && !twins.length ? (
            <p className="text-[14px] text-text-3">{t("radarEmpty")}</p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
