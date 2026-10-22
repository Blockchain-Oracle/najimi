"use client"

import { Orb } from "@najimi/ui/components/orb"
import { cn } from "@najimi/ui/lib/utils"
import {
  Bookmark,
  BookOpen,
  Clapperboard,
  Ellipsis,
  Gamepad2,
  Heart,
  MapPin,
  Mic,
  Music2,
  Navigation,
  Pin,
  Play,
  Send,
  ShoppingBag,
  Tv,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useRef, useState } from "react"
import { siImdb, siSpotify } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { AppleMusicBadge, PodcastCredit, PreviewCredit } from "@/components/player/credit"
import { Scrubber } from "@/components/player/now-playing"
import type { FeedCard as Card, FeedDomain } from "@/lib/feed-shared"

/*
 * One card of the feed: the whole screen (after TikTok's For You, Refero b79c7237). The artwork's
 * own colour floods the background as a blurred wash, the artwork sits large (square for music
 * and podcasts, a poster for films, shows and books; places and brands fill the screen with their
 * photo), and the details sit bottom-left over a fade. The action rail runs down the right.
 * Tap to pause or play; double-tap to love.
 */

export const DOMAIN_ICON: Record<FeedDomain, typeof Music2> = {
  artist: Music2,
  podcast: Mic,
  movie: Clapperboard,
  tv_show: Tv,
  book: BookOpen,
  brand: ShoppingBag,
  place: MapPin,
  videogame: Gamepad2,
}

/** Domains whose picture is a photo of the thing, shown full-screen rather than as a cover. */
const PHOTO: FeedDomain[] = ["place", "videogame"]
const POSTER: FeedDomain[] = ["movie", "tv_show", "book"]
/** Brands come as logos: on a white tile, never stretched across the screen. */
const LOGO: FeedDomain[] = ["brand"]

/** Qloo's images come in any width (`…-420x-auto.jpg`); ask for one that fits the screen. */
const sized = (url: string | null, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : url

export type CardActions = {
  love: () => void
  save: () => void
  hide: () => void
  why: () => void
  share: () => void
  ask: () => void
  togglePlay: () => void
  keepPlaying: () => void
  trailer: () => void
  /** Why this, not for me, and where to open it. */
  more: () => void
}

function RailButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={label}
      aria-pressed={active}
      className="group flex flex-col items-center gap-1 text-[11px] font-semibold text-white drop-shadow"
    >
      <span className="grid size-12 place-items-center rounded-full bg-black/25 ring-1 ring-white/15 backdrop-blur-md transition-transform group-active:scale-90">
        {children}
      </span>
      <span className="max-w-16 truncate">{label}</span>
    </button>
  )
}

function Backdrop({ src, photo }: { src: string | null; photo: boolean }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed)
    return (
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_80%_at_30%_20%,var(--color-aura-2),transparent_60%),radial-gradient(100%_70%_at_80%_90%,var(--color-aura-1),transparent_60%)] opacity-60"
      />
    )
  return (
    // biome-ignore lint/performance/noImgElement: remote artwork as a wash
    <img
      src={src}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
      className={cn(
        "absolute inset-0 size-full object-cover",
        photo ? "opacity-95" : "scale-125 opacity-80 blur-3xl saturate-150",
      )}
    />
  )
}

export function FeedCard({
  card,
  near,
  active,
  playing,
  ownsTrack,
  songIndex,
  loved,
  saved,
  pinned,
  actions,
}: {
  card: Card
  /** Within a few cards of the one on screen: render it (others are empty slots). */
  near: boolean
  active: boolean
  /** This card's audio is the one playing right now. */
  playing: boolean
  ownsTrack: boolean
  songIndex: number
  loved: boolean
  saved: boolean
  pinned: boolean
  actions: CardActions
}) {
  const t = useTranslations("Feed")
  const td = useTranslations("Domains")
  const [burst, setBurst] = useState(0)
  const tap = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null)
  const media = card.media
  const song = media?.kind === "songs" ? media.songs[songIndex % media.songs.length] : null
  const episode = media?.kind === "episode" ? media.episode : null
  const art =
    song?.artwork ?? (episode?.artwork && !card.image ? episode.artwork : null) ?? card.image
  const photo = PHOTO.includes(card.domain)
  const Icon = DOMAIN_ICON[card.domain]
  const audio = Boolean(song || episode)

  if (!near) return <section aria-hidden className="h-full w-full bg-black" />

  // One tap pauses or plays; a second tap in the same spot within a moment loves it instead
  // (and the first tap's pause is cancelled).
  const onTap = (e: React.MouseEvent) => {
    const now = performance.now()
    const prev = lastTap.current
    const again =
      prev && now - prev.at < 300 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 40
    if (again) {
      lastTap.current = null
      if (tap.current) clearTimeout(tap.current)
      tap.current = null
      if (!loved) actions.love()
      setBurst((n) => n + 1)
      return
    }
    lastTap.current = { at: now, x: e.clientX, y: e.clientY }
    tap.current = setTimeout(() => {
      tap.current = null
      if (audio) actions.togglePlay()
    }, 260)
  }

  return (
    <section
      aria-label={t("cardLabel", { domain: td(card.domain), name: card.name })}
      className="relative h-full w-full overflow-hidden bg-black text-white"
    >
      <Backdrop src={sized(art, photo ? 1200 : 420)} photo={photo} />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          photo
            ? "bg-gradient-to-b from-black/45 via-transparent to-black/85"
            : "bg-gradient-to-b from-black/40 via-black/25 to-black/85",
        )}
      />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: the whole card is a tap target; the keyboard has Space */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Space and arrow keys are handled by the feed */}
      <div
        onClick={onTap}
        className="relative mx-auto flex h-full w-full max-w-[30rem] flex-col px-4 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:pb-8"
      >
        {/* The artwork, large: covers and posters sit in the middle; photos are the background. */}
        <div className="flex min-h-0 flex-1 items-center justify-center pe-14 md:pe-0">
          {!photo && art ? (
            // biome-ignore lint/performance/noImgElement: remote artwork at its own size
            <img
              src={sized(art, 800) ?? art}
              alt=""
              className={cn(
                "max-h-full rounded-card shadow-float transition-transform duration-500 ease-out",
                LOGO.includes(card.domain)
                  ? "aspect-square w-[min(62vw,16rem)] bg-white object-contain p-8"
                  : POSTER.includes(card.domain)
                    ? "aspect-[2/3] w-[min(60vw,16rem)] object-cover"
                    : "aspect-square w-[min(76vw,21rem)] object-cover",
                active && audio && !playing && "scale-[0.94]",
              )}
            />
          ) : null}
        </div>

        {/* Details, bottom-left. */}
        <div className="flex max-w-[calc(100%-4rem)] flex-col items-start gap-2 md:max-w-full">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-2.5 py-1 text-[12px] font-semibold backdrop-blur-md">
            <Icon className="size-3.5" />
            {td(card.domain)}
          </span>
          <h2 className="font-title line-clamp-2 text-[32px] leading-[1.02] [text-wrap:balance] drop-shadow-sm">
            {card.name}
          </h2>
          {card.caption || card.area ? (
            <p className="line-clamp-1 text-[14px] text-white/75">
              {card.domain === "place" && card.area ? t("near", { area: card.area }) : card.caption}
            </p>
          ) : null}

          {song && media?.kind === "songs" ? (
            <div className="flex w-full flex-col gap-2">
              <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold">
                <Music2 className="size-4 shrink-0" />
                <span className="truncate">{song.title}</span>
                {media.songs.length > 1 ? (
                  <span className="shrink-0 text-[12px] font-normal text-white/60">
                    {t("songOf", {
                      index: (songIndex % media.songs.length) + 1,
                      count: media.songs.length,
                    })}
                  </span>
                ) : null}
              </p>
              {active && ownsTrack ? <Scrubber thin /> : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <AppleMusicBadge href={song.store} />
                <PreviewCredit />
              </div>
            </div>
          ) : null}

          {episode ? (
            <div className="flex w-full flex-col gap-2">
              <p className="text-[12px] font-semibold tracking-wide text-white/70 uppercase">
                {t("latestEpisode")}
                {episode.seconds ? ` · ${Math.round(episode.seconds / 60)} min` : ""}
              </p>
              <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{episode.title}</p>
              {active && ownsTrack ? <Scrubber thin /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    actions.keepPlaying()
                  }}
                  aria-pressed={pinned}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-semibold ring-1 backdrop-blur-md transition-colors",
                    pinned
                      ? "bg-white text-black ring-white"
                      : "bg-black/40 text-white ring-white/25 hover:bg-black/60",
                  )}
                >
                  <Pin className="size-3.5" />
                  {pinned ? t("keepingPlaying") : t("keepPlaying")}
                </button>
                <PodcastCredit href={episode.store} />
              </div>
            </div>
          ) : null}

          {media?.kind === "trailer" ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                actions.trailer()
              }}
              className="inline-flex items-center gap-2 rounded-pill bg-white px-4 py-2 text-[14px] font-semibold text-black transition-transform active:scale-95"
            >
              <Play className="size-4 fill-current" />
              {t("trailer")}
            </button>
          ) : card.links.imdb ? (
            <ExternalPill
              href={card.links.imdb}
              icon={<BrandIcon icon={siImdb} colored className="size-4" />}
            >
              {t("noTrailer")}
            </ExternalPill>
          ) : null}

          {card.domain === "place" ? (
            <div className="flex flex-wrap items-center gap-2">
              {card.details.slice(0, 3).map((d) => (
                <span
                  key={d}
                  className="rounded-pill bg-white/15 px-2.5 py-1 text-[12px] backdrop-blur-md"
                >
                  {d}
                </span>
              ))}
              {card.links.map ? (
                <ExternalPill href={card.links.map} icon={<Navigation className="size-3.5" />}>
                  {t("directions")}
                </ExternalPill>
              ) : null}
            </div>
          ) : null}

          {card.domain === "artist" && !song && card.links.spotify ? (
            <ExternalPill
              href={card.links.spotify}
              icon={<BrandIcon icon={siSpotify} colored className="size-4" />}
            >
              {t("openSpotify")}
            </ExternalPill>
          ) : null}

          {card.because ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                actions.why()
              }}
              className="inline-flex max-w-full items-center gap-1.5 rounded-pill bg-black/35 px-2.5 py-1 text-start text-[12px] text-white/85 ring-1 ring-white/15 backdrop-blur-md hover:text-white"
            >
              <Heart className="size-3 shrink-0 fill-current" />
              <span className="truncate">
                {t("why")} · {card.because.name}
              </span>
            </button>
          ) : null}
        </div>

        {/* The rail. */}
        <div className="absolute end-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] flex flex-col items-center gap-4 md:-end-20 md:bottom-10">
          <RailButton label={loved ? t("loved") : t("love")} onClick={actions.love} active={loved}>
            <Heart
              className={cn("size-6 transition-colors", loved && "fill-[#FF3B5C] text-[#FF3B5C]")}
            />
          </RailButton>
          <RailButton label={saved ? t("saved") : t("save")} onClick={actions.save} active={saved}>
            <Bookmark className={cn("size-6", saved && "fill-current")} />
          </RailButton>
          <RailButton label={t("ask")} onClick={actions.ask}>
            <Orb size={30} />
          </RailButton>
          <RailButton label={t("share")} onClick={actions.share}>
            <Send className="size-5" />
          </RailButton>
          <RailButton label={t("more")} onClick={actions.more}>
            <Ellipsis className="size-6" />
          </RailButton>
        </div>
      </div>

      {/* The double-tap heart. */}
      <AnimatePresence>
        {burst ? (
          <motion.span
            key={burst}
            aria-hidden
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 1.3] }}
            transition={{ duration: 0.8, times: [0, 0.25, 0.6, 1] }}
            onAnimationComplete={() => setBurst(0)}
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <Heart className="size-28 fill-[#FF3B5C] text-[#FF3B5C] drop-shadow-lg" />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

function ExternalPill({
  href,
  icon,
  children,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded-pill bg-black/40 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-black/60"
    >
      {icon}
      {children}
    </a>
  )
}

export function FeedCardSkeleton() {
  return (
    <section
      aria-hidden
      className="relative grid h-dvh w-full place-items-center overflow-hidden bg-black"
    >
      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_40%,var(--color-aura-2),transparent_70%)] opacity-30" />
      <div className="relative flex flex-col items-center gap-6">
        <div className="aspect-square w-[min(76vw,21rem)] animate-pulse rounded-card bg-white/10" />
        <div className="h-8 w-48 animate-pulse rounded-pill bg-white/10" />
      </div>
    </section>
  )
}
