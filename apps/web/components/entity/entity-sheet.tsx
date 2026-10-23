"use client"

import type { CardMedia } from "@najimi/sources"
import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Bookmark, ChevronDown, EyeOff, GitBranchPlus, Pause, Play, Share2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { type ReactNode, useRef, useState } from "react"
import { DarkSheet } from "@/components/feed/dark-sheet"
import type { ShareLove } from "@/components/feed/share-bars"
import { AppleMusicBadge, PodcastCredit, PreviewCredit } from "@/components/player/credit"
import { type Track, usePlayer, usePlayerClock } from "@/components/player/player"
import { type EntityDetails, type EntityRef, type EntityVideo, regionOf } from "@/lib/entity"
import { api } from "@/lib/fetcher"
import { qk } from "@/lib/query-keys"
import { LinkRow, PlaceLinks, TourLinks, VideoRow, WhereToWatch } from "./entity-links"

/*
 * Any thing, opened, from anywhere in the app (a pick on a profile, a film in a chat, a stop on a
 * plan, a node on the graph): a stage that plays it right here (a film's trailer and its other
 * videos, an artist's songs on a record that slides out of the cover and spins while it plays, a
 * podcast's latest episode), then what it is, where it leads (a place's Directions, Uber, Call,
 * site and socials; where to watch a film and what people say about it; an artist's or brand's
 * accounts), what it's made of (each love's share, from Qloo's explainability) and what to do
 * with it. The stage after Netflix's detail sheet (Refero fce97bd8) and 21st.dev's
 * diriktv/music-artwork and ravikatiyar162/video-thumbnail-player; the track list after Vinyls
 * (Refero 02744840); the place row after Google Maps (d81cff6d); the film after Showcase
 * (18e5b761). Music plays through the app's one player, so it keeps going after the sheet closes.
 */

const sized = (url: string | null, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : url

const POSTER = new Set(["urn:entity:movie", "urn:entity:tv_show", "urn:entity:book"])
const FILM = new Set(["urn:entity:movie", "urn:entity:tv_show"])
const WIDE = new Set(["urn:entity:place", "urn:entity:destination"])
const DARK = "#121214"

export type Surface =
  | "feed"
  | "taste"
  | "graph"
  | "room"
  | "player"
  | "earth"
  | "plan"
  | "business"
  | "passport"

/** What the sheet's bottom row does; a missing handler hides its button (someone else's pick). */
export type EntityActions = {
  /** Overrides what the server says (a screen that already knows). */
  saved?: boolean
  onToggleSave?: (saved: boolean) => void
  onMore?: () => void
  onAsk?: () => void
  onNotForMe?: () => void
}

export function useEntityDetails(thing: EntityRef | null) {
  const region = regionOf()
  return useQuery({
    queryKey: qk.entity(thing?.qlooId ?? "", region),
    queryFn: () =>
      api<EntityDetails>(`/api/entities/${thing?.qlooId}?region=${encodeURIComponent(region)}`),
    enabled: Boolean(thing),
    staleTime: 10 * 60_000,
    retry: false,
  })
}

function tracksOf(thing: EntityRef, media: CardMedia | null): Track[] {
  if (media?.kind === "songs")
    return media.songs.map((song) => ({
      id: `${thing.qlooId}:${song.preview}`,
      src: song.preview,
      title: song.title,
      by: song.artist,
      artwork: song.artwork ?? thing.image,
      source: "apple",
      store: song.store,
      pickId: thing.qlooId,
      pickType: thing.type,
    }))
  if (media?.kind === "episode") {
    const e = media.episode
    return [
      {
        id: `${thing.qlooId}:episode`,
        src: e.audio,
        title: e.title,
        by: e.show || thing.name,
        artwork: e.artwork ?? thing.image,
        source: "podcast",
        store: e.store,
        pickId: thing.qlooId,
        pickType: thing.type,
      },
    ]
  }
  return []
}

/** The best page to send someone for this thing. */
function shareUrl(d: EntityDetails | undefined) {
  if (!d) return null
  return (
    d.place?.maps ??
    d.say.find((l) => l.site === "letterboxd" || l.site === "imdb" || l.site === "goodreads")
      ?.url ??
    d.listen[0]?.url ??
    d.read[0]?.url ??
    d.links.open ??
    d.follow[0]?.url ??
    null
  )
}

export function EntitySheet({
  thing,
  loves = [],
  actions,
  surface = "taste",
  onClose,
}: {
  thing: EntityRef | null
  /** The viewer's loves, to name the shares in "Made of your loves". */
  loves?: ShareLove[]
  actions: EntityActions
  surface?: Surface
  onClose: () => void
}) {
  return (
    <DarkSheet
      bare
      open={Boolean(thing)}
      onOpenChange={(o) => (o ? null : onClose())}
      title={thing?.name ?? ""}
    >
      {thing ? (
        <EntityBody
          key={thing.qlooId}
          thing={thing}
          loves={loves}
          actions={actions}
          surface={surface}
        />
      ) : null}
    </DarkSheet>
  )
}

function EntityBody({
  thing,
  loves,
  actions,
  surface,
}: {
  thing: EntityRef
  loves: ShareLove[]
  actions: EntityActions
  surface: Surface
}) {
  const t = useTranslations("Feed")
  const tp = useTranslations("Pick")
  const te = useTranslations("Entity")
  const player = usePlayer()
  const details = useEntityDetails(thing)
  const d = details.data
  // What the card already had plays at once; the full record replaces it when it lands.
  const media = d?.media ?? thing.media ?? null
  const tracks = tracksOf(thing, media)
  const waiting = details.isPending
  const stageRef = useRef<HTMLDivElement>(null)
  // A video from "More videos" plays in the same stage, from the top.
  const [video, setVideo] = useState<EntityVideo | null>(null)
  const isFilm = FILM.has(thing.type)
  const trailer =
    media?.kind === "trailer"
      ? media.trailer
      : isFilm
        ? (d?.videos.find((v) => v.youtube) ?? null)
        : null
  const saved = actions.saved ?? d?.saved ?? false
  const caption = thing.caption ?? d?.entity.caption ?? null
  const year = d?.entity.year ?? null

  const play = async (track: Track) => {
    setVideo(null)
    const result = await player.play(track, tracks)
    if (result !== "playing") return
    // A play from here counts the same as one in the feed: it tells the taste what you reached for.
    void api("/api/feed/signals", {
      json: {
        signals: [
          {
            qlooId: thing.qlooId,
            type: thing.type,
            kind: "play",
            surface,
            name: thing.name,
            image: thing.image,
          },
        ],
      },
    }).catch(() => null)
  }

  const share = async () => {
    const url = shareUrl(d)
    const data = { title: thing.name, text: thing.name, ...(url ? { url } : {}) }
    try {
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(url ?? thing.name)
        toast(te("copied"))
      }
    } catch {
      // Closing the share sheet is not an error.
    }
  }

  return (
    <div className="flex flex-col">
      <div ref={stageRef}>
        {video?.src ? (
          <AppleVideoStage key={video.id} video={video} onStart={player.pause} />
        ) : video?.youtube ? (
          <TrailerStage
            key={video.id}
            trailer={{ youtube: video.youtube, title: video.title }}
            autoplay
            onStart={player.pause}
          />
        ) : trailer ? (
          <TrailerStage
            key={trailer.youtube}
            trailer={{ youtube: trailer.youtube ?? "", title: trailer.title }}
            autoplay={false}
            onStart={player.pause}
          />
        ) : waiting && isFilm ? (
          <TrailerWaiting thing={thing} />
        ) : tracks.length ? (
          <RecordStage thing={thing} tracks={tracks} disc={media?.kind === "songs"} onPlay={play} />
        ) : (
          <ArtStage
            thing={thing}
            cover={media?.kind === "cover" ? media.image : (d?.place?.logo ?? d?.logo ?? null)}
            waiting={waiting}
          />
        )}
      </div>

      <div className="flex flex-col gap-6 px-5 pt-2">
        <header className="flex flex-col gap-2">
          {/* The sheet's own (screen-reader) title carries the name; this is its visible face. */}
          <p aria-hidden className="font-title text-[30px] leading-[1.02] text-balance">
            {thing.name}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-white/60">
            {thing.affinity != null ? (
              <span className="font-semibold text-white">
                <span className="bg-[linear-gradient(90deg,var(--color-aura-1),var(--color-aura-2))] bg-clip-text font-title text-[17px] text-transparent">
                  {Math.round(thing.affinity * 100)}%
                </span>{" "}
                {tp("matchWord")}
              </span>
            ) : null}
            {caption ? <span>{caption}</span> : null}
            {year ? <span>{year}</span> : null}
            {thing.area ? <span>{t("near", { area: thing.area })}</span> : null}
          </p>
        </header>

        <MadeOf shares={thing.shares ?? []} loves={loves} />

        {/* The same sections for every kind, in the same order; a kind shows the ones it has. */}
        {tracks.length ? <TrackList tracks={tracks} owner={thing.name} onPlay={play} /> : null}
        {waiting ? <LinksWaiting /> : null}
        {d?.place ? <PlaceLinks name={thing.name} place={d.place} /> : null}
        {d?.film ? <WhereToWatch film={d.film} /> : null}
        {d ? <LinkRow title={te("whereToListen")} links={d.listen} /> : null}
        {d ? <LinkRow title={te("whereToRead")} links={d.read} /> : null}
        {d ? (
          <VideoRow
            videos={d.videos}
            playing={video?.id ?? null}
            onPlay={(v) => {
              setVideo(v)
              stageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
            }}
          />
        ) : null}
        {d ? <TourLinks tour={d.tour} /> : null}
        {d ? <LinkRow title={te("whatPeopleSay")} links={d.say} /> : null}
        {d ? <LinkRow title={te("follow")} links={d.follow} /> : null}

        {d?.entity.description ? <About text={d.entity.description} /> : null}

        <div className="flex justify-around border-t border-white/[0.08] pt-3">
          {actions.onToggleSave ? (
            <Action
              label={saved ? tp("unsave") : tp("save")}
              onClick={() => actions.onToggleSave?.(saved)}
              pressed={saved}
            >
              <Bookmark className={cn("size-6", saved && "fill-current")} strokeWidth={1.75} />
            </Action>
          ) : null}
          {actions.onMore ? (
            <Action label={tp("more")} onClick={actions.onMore}>
              <GitBranchPlus className="size-6" strokeWidth={1.75} />
            </Action>
          ) : null}
          {actions.onAsk ? (
            <Action label={te("ask")} onClick={actions.onAsk}>
              <Orb size={24} />
            </Action>
          ) : null}
          <Action label={te("share")} onClick={share}>
            <Share2 className="size-6" strokeWidth={1.75} />
          </Action>
          {actions.onNotForMe ? (
            <Action label={tp("notForMe")} onClick={actions.onNotForMe} tone="danger">
              <EyeOff className="size-6" strokeWidth={1.75} />
            </Action>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** The pill rows while the links are found: the same height, so nothing jumps. */
function LinksWaiting() {
  return (
    <div className="flex gap-2" aria-hidden>
      {[28, 20, 24].map((w) => (
        <span
          key={w}
          className="h-10 animate-pulse rounded-pill bg-white/[0.07]"
          style={{ width: `${w * 4}px` }}
        />
      ))}
    </div>
  )
}

/** What it is, in Qloo's words: three lines, the rest on a tap. */
function About({ text }: { text: string }) {
  const te = useTranslations("Entity")
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      className="flex flex-col items-start gap-1 text-start"
    >
      <span className={cn("text-[14px] leading-relaxed text-white/75", !open && "line-clamp-3")}>
        {text}
      </span>
      {open ? null : <span className="text-[13px] font-semibold text-white">{te("more")}</span>}
    </button>
  )
}

// ── Stages ────────────────────────────────────────────────────────────────────────────────────

/** The artwork, blown up and blurred into the sheet's own background. */
function Backdrop({ src }: { src: string | null }) {
  return (
    <>
      {src ? (
        // biome-ignore lint/performance/noImgElement: remote artwork, used as a blurred wash
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-60 blur-2xl saturate-150"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_30%_30%,var(--color-aura-1),transparent_70%),radial-gradient(60%_80%_at_75%_40%,var(--color-aura-2),transparent_70%)] opacity-40"
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 55%, ${DARK} 100%)`,
        }}
      />
    </>
  )
}

/** A film or show: its trailer's still with a play button; one tap plays it right here. */
function TrailerStage({
  trailer,
  autoplay,
  onStart,
}: {
  trailer: { youtube: string; title: string }
  /** A video picked from "More videos" starts at once. */
  autoplay: boolean
  onStart: () => void
}) {
  const tp = useTranslations("Pick")
  const [playing, setPlaying] = useState(autoplay)
  const [still, setStill] = useState(`https://i.ytimg.com/vi/${trailer.youtube}/maxresdefault.jpg`)
  if (playing)
    return (
      <div className="aspect-video w-full bg-black">
        <iframe
          title={trailer.title}
          src={`https://www.youtube-nocookie.com/embed/${trailer.youtube}?autoplay=1&playsinline=1&rel=0`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full"
        />
      </div>
    )
  return (
    <button
      type="button"
      aria-label={tp("playTrailer")}
      onClick={() => {
        onStart()
        setPlaying(true)
      }}
      className="group relative isolate block aspect-video w-full overflow-hidden bg-black"
    >
      {/* biome-ignore lint/performance/noImgElement: YouTube's own still for the trailer */}
      <img
        src={still}
        alt=""
        onError={() => setStill(`https://i.ytimg.com/vi/${trailer.youtube}/hqdefault.jpg`)}
        // With no high-res still YouTube answers with a 120px grey placeholder, not an error.
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth <= 120)
            setStill(`https://i.ytimg.com/vi/${trailer.youtube}/hqdefault.jpg`)
        }}
        className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      />
      <span
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 35%, transparent 60%, ${DARK} 100%)`,
        }}
      />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-16 place-items-center rounded-full bg-white/20 ring-1 ring-white/35 backdrop-blur-md transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
          <Play className="ms-1 size-7 fill-white text-white" />
        </span>
      </span>
      <span className="absolute bottom-3 left-5 flex items-center gap-2 text-[12px] font-semibold tracking-[0.1em] text-white/85 uppercase">
        <span className="size-1.5 rounded-full bg-signal" />
        {tp("trailer")}
      </span>
    </button>
  )
}

/** A film while its trailer is found: the same 16:9 stage, so nothing jumps when it arrives. */
function TrailerWaiting({ thing }: { thing: EntityRef }) {
  return (
    <div className="relative isolate grid aspect-video w-full place-items-center overflow-hidden">
      <Backdrop src={sized(thing.image, 600)} />
      <span className="size-16 animate-pulse rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-md" />
    </div>
  )
}

/** An artist's music video: Apple's 30-second preview, played right here. */
function AppleVideoStage({ video, onStart }: { video: EntityVideo; onStart: () => void }) {
  return (
    <div className="relative aspect-video w-full bg-black">
      {/* biome-ignore lint/a11y/useMediaCaption: Apple's music video previews come without captions */}
      <video
        src={video.src}
        poster={video.poster ?? undefined}
        autoPlay
        controls
        playsInline
        onPlay={onStart}
        className="size-full"
      />
      {video.store ? (
        <AppleMusicBadge href={video.store} className="absolute top-3 left-3" />
      ) : null}
    </div>
  )
}

/**
 * An artist or podcast: the cover, and for music a record behind it that slides out and spins
 * while it plays (it stops where it was when you pause).
 */
function RecordStage({
  thing,
  tracks,
  disc,
  onPlay,
}: {
  thing: EntityRef
  tracks: Track[]
  disc: boolean
  onPlay: (track: Track) => void
}) {
  const tp = useTranslations("Pick")
  const player = usePlayer()
  const current = tracks.find((tr) => tr.id === player.track?.id) ?? null
  const lead = current ?? (tracks[0] as Track)
  const spinning = Boolean(current) && player.playing
  const out = Boolean(current)
  const art = sized(thing.image, 600) ?? lead.artwork
  return (
    <div className="relative isolate flex h-[18rem] items-center justify-center overflow-hidden pt-4">
      <Backdrop src={art} />
      <div
        className={cn(
          "relative transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
          disc && out && "-translate-x-[24%]",
        )}
      >
        {disc ? (
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 left-1/2 size-44 -translate-y-1/2 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
              out ? "translate-x-[4%]" : "-translate-x-1/2",
            )}
          >
            <span
              className="relative block size-full animate-spin rounded-full shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)]"
              style={{
                animationDuration: "2.4s",
                animationPlayState: spinning ? "running" : "paused",
                background:
                  "repeating-radial-gradient(circle at center, #0b0b0d 0 1.5px, #19191c 1.5px 3px)",
              }}
            >
              {lead.artwork ? (
                // biome-ignore lint/performance/noImgElement: the record's label is the song's artwork
                <img
                  src={lead.artwork}
                  alt=""
                  className="absolute inset-[31%] size-[38%] rounded-full object-cover"
                />
              ) : null}
              <span className="absolute inset-[48%] rounded-full bg-[#0b0b0d]" />
            </span>
            {/* The light on the grooves stays put while the record turns. */}
            <span className="pointer-events-none absolute inset-0 rounded-full bg-[conic-gradient(from_20deg,transparent_0deg,rgba(255,255,255,0.10)_35deg,transparent_75deg,transparent_200deg,rgba(255,255,255,0.07)_235deg,transparent_275deg)]" />
          </span>
        ) : null}
        <button
          type="button"
          aria-label={spinning ? tp("pause") : tp("play")}
          onClick={() => (current ? player.toggle() : onPlay(lead))}
          className={cn(
            "group relative block size-44 overflow-hidden rounded-[18px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.85)] ring-1 ring-white/10 transition-transform duration-300 active:scale-[0.97]",
            !disc && spinning && "ring-2 ring-[var(--color-aura-1)]",
          )}
        >
          {art ? (
            // biome-ignore lint/performance/noImgElement: remote artwork
            <img src={art} alt="" className="size-full object-cover" />
          ) : (
            <span className="block size-full bg-white/10" />
          )}
          <span className="absolute bottom-2.5 left-2.5 grid size-11 place-items-center rounded-full bg-white text-black shadow-float transition-transform duration-200 group-hover:scale-105">
            {spinning ? (
              <Pause className="size-5 fill-current" />
            ) : (
              <Play className="ms-0.5 size-5 fill-current" />
            )}
          </span>
        </button>
      </div>
      {lead.source === "apple" && lead.store ? (
        <AppleMusicBadge href={lead.store} className="absolute top-4 left-4" />
      ) : null}
    </div>
  )
}

/** Anything without sound: its artwork, large, on its own colour. */
function ArtStage({
  thing,
  cover,
  waiting,
}: {
  thing: EntityRef
  cover: string | null
  waiting: boolean
}) {
  const art = sized(thing.image, 600) ?? cover
  return (
    <div className="relative isolate flex h-[17rem] items-end justify-center overflow-hidden pb-5">
      <Backdrop src={art} />
      {art ? (
        // biome-ignore lint/performance/noImgElement: remote artwork
        <img
          src={art}
          alt=""
          className={cn(
            "rounded-[16px] object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,0.85)] ring-1 ring-white/10",
            POSTER.has(thing.type)
              ? "aspect-[2/3] h-56"
              : WIDE.has(thing.type)
                ? "aspect-[4/3] h-48"
                : "size-48",
          )}
        />
      ) : null}
      {waiting ? (
        <span className="absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-md" />
      ) : null}
    </div>
  )
}

// ── Below the stage ───────────────────────────────────────────────────────────────────────────

function TrackList({
  tracks,
  owner,
  onPlay,
}: {
  tracks: Track[]
  /** Whose songs these are: their name isn't repeated under every title. */
  owner: string
  onPlay: (track: Track) => void
}) {
  const tp = useTranslations("Pick")
  const player = usePlayer()
  const apple = tracks[0]?.source === "apple"
  return (
    <section className="flex flex-col gap-1">
      <ol className="flex flex-col">
        {tracks.map((tr) => {
          const on = player.track?.id === tr.id
          return (
            <li key={tr.id}>
              <button
                type="button"
                onClick={() => (on ? player.toggle() : onPlay(tr))}
                className="flex w-full items-center gap-3 rounded-tile px-1 py-2 text-start transition-colors hover:bg-white/[0.05]"
              >
                <span className="relative grid size-10 shrink-0 place-items-center">
                  {on ? (
                    <Progress />
                  ) : (
                    <span className="absolute inset-0 rounded-full ring-1 ring-white/20" />
                  )}
                  {on && player.playing ? (
                    <Pause className="size-4 fill-current" />
                  ) : (
                    <Play className="ms-0.5 size-4 fill-current" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "truncate text-[15px] font-semibold",
                      on && "text-[var(--color-aura-1)]",
                    )}
                  >
                    {tr.title}
                  </span>
                  {tr.source === "podcast" || tr.by !== owner ? (
                    <span className="truncate text-[13px] text-white/55">
                      {tr.source === "podcast" ? tp("latest") : tr.by}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {apple ? <PreviewCredit className="ps-1" /> : null}
      {!apple && tracks[0]?.store ? <PodcastCredit href={tracks[0].store} /> : null}
    </section>
  )
}

/** How far the playing track is, as a ring round its button. */
function Progress() {
  const player = usePlayer()
  const clock = usePlayerClock()
  const share = player.duration ? Math.min(1, clock / player.duration) : 0
  const r = 18
  const length = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="var(--color-aura-1)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - share)}
      />
    </svg>
  )
}

/**
 * Why it's here, in one line: the loves it's made of (Qloo's explainability) as faces, the top
 * two named. A tap opens each love's share as one bar split between them.
 */
function MadeOf({
  shares,
  loves,
}: {
  shares: { id: string; share: number }[]
  loves: ShareLove[]
}) {
  const tp = useTranslations("Pick")
  const [open, setOpen] = useState(false)
  const byId = new Map(loves.map((l) => [l.qlooId.toLowerCase(), l]))
  const rows = shares
    .map((s) => ({ ...s, love: byId.get(s.id.toLowerCase()) }))
    .filter((s): s is typeof s & { love: ShareLove } => Boolean(s.love))
    .sort((a, b) => b.share - a.share)
  if (!rows.length) return null
  const total = rows.reduce((sum, s) => sum + s.share, 0) || 1
  const colour = (i: number) =>
    `color-mix(in oklab, var(--color-aura-1) ${Math.round(100 - (i * 100) / Math.max(rows.length - 1, 1))}%, var(--color-aura-2))`
  const face = (r: (typeof rows)[number], i: number, size: string) =>
    r.love.image ? (
      // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
      <img
        src={r.love.image}
        alt=""
        className={cn(size, "rounded-full object-cover")}
        style={{ boxShadow: `0 0 0 2px ${colour(i)}` }}
      />
    ) : (
      <span className={cn(size, "rounded-full")} style={{ background: colour(i) }} />
    )
  return (
    <section className="-mt-2 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={tp("madeOf")}
        className="flex w-fit max-w-full items-center gap-2.5 text-start"
      >
        <span className="flex shrink-0 -space-x-1.5">
          {rows.slice(0, 4).map((r, i) => (
            <span key={r.id} className="rounded-full ring-2 ring-[#121214]">
              {face(r, i, "size-6")}
            </span>
          ))}
        </span>
        <span className="min-w-0 truncate text-[13px] text-white/65">
          {tp("madeOfLine", {
            names: rows
              .slice(0, 2)
              .map((r) => r.love.name)
              .join(", "),
            more: Math.max(0, rows.length - 2),
          })}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-white/45 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-3">
          <div className="flex h-2 w-full gap-1">
            {rows.map((r, i) => (
              <span
                key={r.id}
                className="h-full rounded-full"
                style={{ flexGrow: r.share / total, background: colour(i) }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-2">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-pill bg-white/[0.06] py-1 ps-1 pe-3"
              >
                {face(r, i, "size-6")}
                <span className="max-w-[9rem] truncate text-[13px] font-semibold">
                  {r.love.name}
                </span>
                <span className="text-[13px] text-white/60 tabular-nums">
                  {Math.round((r.share / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function Action({
  label,
  children,
  onClick,
  pressed,
  tone,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  pressed?: boolean
  tone?: "danger"
}) {
  const className = cn(
    "flex min-w-16 flex-col items-center gap-1.5 rounded-tile px-2 py-2 text-[12px] font-medium transition-colors hover:bg-white/[0.06]",
    tone === "danger" ? "text-[#FF6B7A]" : "text-white/85",
  )
  return (
    <button type="button" className={className} onClick={onClick} aria-pressed={pressed}>
      {children}
      {label}
    </button>
  )
}
