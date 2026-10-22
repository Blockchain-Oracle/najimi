"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { FEED, TASTE } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"
import { EyeOff, Heart, Loader2, X } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { siApplemusic, siImdb, siSpotify } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { CallDetails } from "@/components/qloo/call-details"
import { FEED_DOMAINS, type FeedCard, type FeedLove, type FeedMix } from "@/lib/feed-shared"

/*
 * The feed's sheets, dark like the feed itself: why a card is here (each love's share and the
 * Qloo call), tuning the feed (categories and what drives it), more actions, and the trailer
 * (YouTube's player, visible and started by a tap, as its terms ask).
 */

function DarkSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[88svh] w-full max-w-lg flex-col overflow-hidden rounded-t-sheet bg-[#121214] text-white shadow-float transition duration-300 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full md:bottom-6 md:rounded-sheet",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/20" />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <Dialog.Title className="font-title text-[22px]">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/15"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Why this card: its match, then how much each love pulled it in (explainability). */
export function WhySheet({
  card,
  loves,
  onClose,
}: {
  card: FeedCard | null
  loves: FeedLove[]
  onClose: () => void
}) {
  const t = useTranslations("Feed")
  const byId = new Map(loves.map((l) => [l.qlooId.toLowerCase(), l]))
  const shares = (card?.shares ?? [])
    .map((s) => ({ ...s, love: byId.get(s.id.toLowerCase()) }))
    .filter((s) => s.love)
    .sort((a, b) => b.share - a.share)
  const total = shares.reduce((sum, s) => sum + s.share, 0) || 1
  return (
    <DarkSheet
      open={Boolean(card)}
      onOpenChange={(o) => (o ? null : onClose())}
      title={t("whyTitle")}
    >
      {card ? (
        <div className="flex flex-col gap-5">
          <p className="text-[14px] text-white/75">
            {card.affinity != null
              ? t("whyLead", { value: Math.round(card.affinity * 100) })
              : t("whyNone")}
          </p>
          {shares.length ? (
            <ul className="flex flex-col gap-3">
              {shares.map((s) => {
                const pct = Math.round((s.share / total) * 100)
                return (
                  <li key={s.id} className="flex items-center gap-3">
                    {s.love?.image ? (
                      // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
                      <img
                        src={s.love.image}
                        alt=""
                        className="size-10 shrink-0 rounded-[10px] object-cover"
                      />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-white/10">
                        <Heart className="size-4" />
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold">{s.love?.name}</span>
                        <span className="text-[13px] text-white/70 tabular-nums">{pct}%</span>
                      </div>
                      <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-aura-1),var(--color-aura-2))]"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
          <div className="flex flex-col gap-2 rounded-card bg-white/5 p-4">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-white/55 uppercase">
              {t("evidence")}
            </p>
            <CallDetails callId={card.callId} />
          </div>
        </div>
      ) : null}
    </DarkSheet>
  )
}

/** More: not for me, why this, and where to open it. */
export function MoreSheet({
  card,
  onClose,
  onWhy,
  onHide,
}: {
  card: FeedCard | null
  onClose: () => void
  onWhy: () => void
  onHide: () => void
}) {
  const t = useTranslations("Feed")
  const song = card?.media?.kind === "songs" ? card.media.songs[0] : null
  const row =
    "flex w-full items-center gap-3 rounded-tile px-3 py-3 text-start text-[15px] font-semibold hover:bg-white/5"
  const site = (href: string) => {
    try {
      return new URL(href).hostname.replace(/^www\./, "")
    } catch {
      return href
    }
  }
  return (
    <DarkSheet
      open={Boolean(card)}
      onOpenChange={(o) => (o ? null : onClose())}
      title={card?.name ?? ""}
    >
      {card ? (
        <div className="flex flex-col">
          <button type="button" className={row} onClick={onWhy}>
            <Heart className="size-5" /> {t("why")}
          </button>
          {song ? (
            <a className={row} href={song.store} target="_blank" rel="noopener noreferrer">
              <BrandIcon icon={siApplemusic} colored /> {t("listenOn")} {t("appleMusic")}
            </a>
          ) : null}
          {card.links.spotify ? (
            <a className={row} href={card.links.spotify} target="_blank" rel="noopener noreferrer">
              <BrandIcon icon={siSpotify} colored /> {t("openSpotify")}
            </a>
          ) : null}
          {card.links.imdb ? (
            <a className={row} href={card.links.imdb} target="_blank" rel="noopener noreferrer">
              <BrandIcon icon={siImdb} colored /> {t("openOn", { site: "IMDb" })}
            </a>
          ) : card.links.open && !card.links.spotify ? (
            <a className={row} href={card.links.open} target="_blank" rel="noopener noreferrer">
              <span className="grid size-5 place-items-center text-[13px]">↗</span>
              {t("openOn", { site: site(card.links.open) })}
            </a>
          ) : null}
          <button type="button" className={cn(row, "text-[#FF6B7A]")} onClick={onHide}>
            <EyeOff className="size-5" /> {t("hide")}
          </button>
        </div>
      ) : null}
    </DarkSheet>
  )
}

/** The trailer: YouTube's own player, visible, started by the tap that opened it. */
export function TrailerSheet({ card, onClose }: { card: FeedCard | null; onClose: () => void }) {
  const trailer = card?.media?.kind === "trailer" ? card.media.trailer : null
  return (
    <DarkSheet
      open={Boolean(trailer)}
      onOpenChange={(o) => (o ? null : onClose())}
      title={card?.name ?? ""}
      className="max-w-3xl"
    >
      {trailer ? (
        <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
          <iframe
            title={trailer.title}
            src={`https://www.youtube-nocookie.com/embed/${trailer.youtube}?autoplay=1&playsinline=1&rel=0`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="size-full"
          />
        </div>
      ) : null}
    </DarkSheet>
  )
}

function WhiteSlider({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (value: number) => void
  label: string
}) {
  return (
    <SliderPrimitive.Root
      aria-label={label}
      value={value}
      min={TASTE.weightMin}
      max={TASTE.weightMax}
      step={1}
      onValueChange={(v) => onChange(Array.isArray(v) ? (v[0] ?? value) : v)}
      className="w-full"
    >
      <SliderPrimitive.Control className="relative flex h-6 w-full touch-none items-center select-none">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/15">
          <SliderPrimitive.Indicator className="h-full bg-[linear-gradient(90deg,var(--color-aura-1),var(--color-aura-2))]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-5 rounded-full bg-white shadow-lift focus-visible:ring-4 focus-visible:ring-white/30 focus-visible:outline-none" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

/**
 * Tune your feed: how much of each category it shows (saved, the feed starts over), and how much
 * each love counts (the cards ahead reorder at once; Qloo refines them in the background).
 */
export function TuneSheet({
  open,
  onOpenChange,
  mix,
  onMix,
  loves,
  weights,
  onWeight,
  refining,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mix: FeedMix
  onMix: (domain: keyof FeedMix, level: number) => void
  loves: FeedLove[]
  weights: Record<string, number>
  onWeight: (love: FeedLove, weight: number) => void
  refining: boolean
}) {
  const t = useTranslations("Feed")
  const td = useTranslations("Domains")
  const levels = Array.from({ length: FEED.mixMax + 1 }, (_, i) => i)
  return (
    <DarkSheet open={open} onOpenChange={onOpenChange} title={t("tune")}>
      <div className="flex flex-col gap-7">
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-[15px] font-semibold">{t("mix")}</h3>
            <p className="text-[13px] text-white/60">{t("mixHint")}</p>
          </div>
          <ul className="flex flex-col gap-2">
            {FEED_DOMAINS.map((d) => (
              <li key={d} className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium">{td(d)}</span>
                <fieldset className="flex rounded-pill bg-white/8 p-0.5" aria-label={td(d)}>
                  {levels.map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={mix[d] === level}
                      onClick={() => onMix(d, level)}
                      className={cn(
                        "rounded-pill px-2.5 py-1 text-[12px] font-semibold transition-colors",
                        mix[d] === level ? "bg-white text-black" : "text-white/65 hover:text-white",
                      )}
                    >
                      {t(`levels.${level}` as "levels.0")}
                    </button>
                  ))}
                </fieldset>
              </li>
            ))}
          </ul>
        </section>
        {loves.length ? (
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                {t("weights")}
                {refining ? (
                  <span className="inline-flex items-center gap-1 text-[12px] font-normal text-white/60">
                    <Loader2 className="size-3 animate-spin" /> {t("refining")}
                  </span>
                ) : null}
              </h3>
              <p className="text-[13px] text-white/60">{t("weightsHint")}</p>
            </div>
            <ul className="flex flex-col gap-3">
              {loves.map((love) => (
                <li key={love.id} className="flex items-center gap-3">
                  {love.image ? (
                    // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
                    <img
                      src={love.image}
                      alt=""
                      className="size-10 shrink-0 rounded-[10px] object-cover"
                    />
                  ) : (
                    <span className="size-10 shrink-0 rounded-[10px] bg-white/10" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[14px] font-semibold">{love.name}</span>
                    <WhiteSlider
                      label={love.name}
                      value={weights[love.qlooId.toLowerCase()] ?? love.weight}
                      onChange={(w) => onWeight(love, w)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </DarkSheet>
  )
}
