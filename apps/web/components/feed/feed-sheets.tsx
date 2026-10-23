"use client"

import { FEED, TASTE } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"
import { EyeOff, Heart, Info, Loader2 } from "lucide-react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { siApplemusic, siImdb, siSpotify } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { CallDetails } from "@/components/qloo/call-details"
import {
  FEED_DOMAINS,
  type FeedCard,
  type FeedDomain,
  type FeedLove,
  type FeedMix,
} from "@/lib/feed-shared"
import { DarkSheet } from "./dark-sheet"
import { Fader } from "./fader"
import { DOMAIN_ICON } from "./feed-card"
import { Knob } from "./knob"
import { ShareBars } from "./share-bars"

/*
 * The feed's sheets, dark like the feed itself: why a card is here (each love's share and the
 * Qloo call), tuning the feed (categories and what drives it), more actions, and the trailer
 * (YouTube's player, visible and started by a tap, as its terms ask).
 */

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
          <ShareBars shares={card.shares} loves={loves} />
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

/** More: everything about it, not for me, why this, and where to open it. */
export function MoreSheet({
  card,
  onClose,
  onOpen,
  onWhy,
  onHide,
}: {
  card: FeedCard | null
  onClose: () => void
  /** Everything about it, in the entity sheet (where to watch, the map, its socials). */
  onOpen: () => void
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
          <button type="button" className={row} onClick={onOpen}>
            <Info className="size-5" /> {t("everything")}
          </button>
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

/**
 * Tune your feed, as a mixing desk: a fader per category (how much of it plays; saved, and the
 * feed starts over) and a knob per love (how much it counts; the cards ahead reorder as you turn,
 * and Qloo refines them in the background). The strip at the top is what plays next, live.
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
  previews,
  upNext,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mix: FeedMix
  onMix: (domain: keyof FeedMix, level: number) => void
  loves: FeedLove[]
  weights: Record<string, number>
  onWeight: (love: FeedLove, weight: number) => void
  refining: boolean
  /** Each category's next card artwork: the fader caps. */
  previews: Partial<Record<FeedDomain, string | null>>
  /** The next few cards, in the order they'll play. */
  upNext: FeedCard[]
}) {
  const t = useTranslations("Feed")
  const td = useTranslations("Domains")
  return (
    <DarkSheet open={open} onOpenChange={onOpenChange} title={t("tune")}>
      <div className="flex flex-col gap-6">
        {upNext.length ? (
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] text-white/55 uppercase">
              {t("upNext")}
              {refining ? (
                <span className="inline-flex items-center gap-1 font-normal tracking-normal normal-case">
                  <Loader2 className="size-3 animate-spin" /> {t("refining")}
                </span>
              ) : null}
            </h3>
            <ol className="flex gap-2 overflow-hidden">
              {upNext.map((c, i) => (
                <motion.li
                  key={c.id}
                  layout
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="relative w-16 shrink-0"
                >
                  {c.image ? (
                    // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
                    <img
                      src={c.image}
                      alt=""
                      className="aspect-square w-16 rounded-tile object-cover"
                    />
                  ) : (
                    <span className="grid aspect-square w-16 place-items-center rounded-tile bg-white/10 text-[11px]">
                      {c.name.slice(0, 2)}
                    </span>
                  )}
                  <span className="absolute top-1 start-1 grid size-4 place-items-center rounded-full bg-black/60 text-[9px] font-bold">
                    {i + 1}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-white/70">{c.name}</span>
                </motion.li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-[15px] font-semibold">{t("mix")}</h3>
            <p className="text-[13px] text-white/60">{t("mixHint")}</p>
          </div>
          <div className="grid grid-cols-8 justify-items-center gap-1 rounded-card bg-white/[0.04] px-1 py-4 ring-1 ring-white/5">
            {FEED_DOMAINS.map((d) => (
              <Fader
                key={d}
                label={td(d)}
                levelLabel={t(`levels.${mix[d]}` as "levels.0")}
                icon={DOMAIN_ICON[d]}
                image={previews[d] ?? null}
                value={mix[d]}
                levels={FEED.mixMax + 1}
                onValueChange={(level) => onMix(d, level)}
              />
            ))}
          </div>
        </section>

        {loves.length ? (
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-[15px] font-semibold">{t("weights")}</h3>
              <p className="text-[13px] text-white/60">{t("weightsHint")}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3">
              {loves.map((love) => (
                <Knob
                  key={love.id}
                  label={love.name}
                  image={love.image}
                  value={weights[love.qlooId.toLowerCase()] ?? love.weight}
                  min={TASTE.weightMin}
                  max={TASTE.weightMax}
                  defaultValue={TASTE.weightDefault}
                  onValueChange={(w) => onWeight(love, w)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </DarkSheet>
  )
}
