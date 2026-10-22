"use client"

import { FEED } from "@najimi/config"
import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Play, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type Track, usePlayer } from "@/components/player/player"
import {
  type FeedCard as Card,
  type FeedLove,
  type FeedMix,
  type FeedPage,
  mixOf,
  refit,
} from "@/lib/feed-shared"
import { api } from "@/lib/fetcher"
import { qk } from "@/lib/query-keys"
import { sound } from "@/lib/sounds"
import { FeedCard, FeedCardSkeleton } from "./feed-card"
import { MoreSheet, TrailerSheet, TuneSheet, WhySheet } from "./feed-sheets"
import { useSignals } from "./use-signals"

/*
 * The feed (W4, W5): your taste a card at a time, full screen, snapping as you swipe. The card on
 * screen drives the one player: music cards play Apple previews (an artist's top songs in turn),
 * podcast cards play their latest episode, film cards offer the trailer. One tap starts sound
 * for good; after that every swipe just plays. Only the cards near the one on screen are drawn,
 * the next page loads before you reach the end, and you come back to where you left off.
 */

/** Where you were, so leaving the feed and coming back lands on the same card. */
let lastActive = 0

function trackOf(card: Card, songIndex: number): Track | null {
  const media = card.media
  if (media?.kind === "songs" && media.songs.length) {
    const song = media.songs[songIndex % media.songs.length]
    if (!song) return null
    return {
      id: `${card.id}:${song.preview}`,
      src: song.preview,
      title: song.title,
      by: song.artist,
      artwork: song.artwork ?? card.image,
      source: "apple",
      store: song.store,
      pickId: card.id,
      pickType: card.type,
    }
  }
  if (media?.kind === "episode") {
    const e = media.episode
    return {
      id: `${card.id}:episode`,
      src: e.audio,
      title: e.title,
      by: e.show || card.name,
      artwork: e.artwork ?? card.image,
      source: "podcast",
      store: e.store,
      pickId: card.id,
      pickType: card.type,
    }
  }
  return null
}

/** Everything the card can play, in order: what the player walks through once you leave the feed. */
function queueOf(card: Card): Track[] {
  const n = card.media?.kind === "songs" ? card.media.songs.length : 1
  return Array.from({ length: n }, (_, i) => trackOf(card, i)).filter((t): t is Track => Boolean(t))
}

function Message({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 grid place-items-center bg-black px-8 text-center text-white md:start-[5.5rem]">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <Orb size={120} working />
        <h1 className="font-title text-[28px] leading-tight">{title}</h1>
        {body ? <p className="text-[15px] text-white/70">{body}</p> : null}
        {action}
      </div>
    </div>
  )
}

export function FeedView() {
  const t = useTranslations("Feed")
  const router = useRouter()
  const player = usePlayer()
  const queryClient = useQueryClient()
  const scroller = useRef<HTMLDivElement>(null)

  const feed = useInfiniteQuery({
    queryKey: qk.feed,
    queryFn: ({ pageParam }) =>
      api<FeedPage>(`/api/feed${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: null as string | null,
    // Stop when a page brings nothing new (Qloo didn't answer, or only repeats came back): the
    // next visit tries again, rather than asking over and over now.
    getNextPageParam: (last, all) => {
      const earlier = new Set(all.slice(0, -1).flatMap((p) => p.cards.map((c) => c.id)))
      return last.cards.some((c) => !earlier.has(c.id)) ? last.next : null
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const pages = feed.data?.pages ?? []
  const meta = pages.at(-1)?.meta ?? pages[0]?.meta
  const loves = meta?.loves ?? []

  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [loved, setLoved] = useState<Set<string>>(() => new Set())
  const [saved, setSaved] = useState<Map<string, boolean>>(() => new Map())
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [mix, setMix] = useState<FeedMix | null>(null)
  const [active, setActive] = useState(lastActive)
  /** Which of a card's songs is on (an artist's top songs play in turn). */
  const [song, setSong] = useState<{ id: string | null; index: number }>({ id: null, index: 0 })
  /** The order of the cards once a love's weight moved (re-ranked once, then kept as you swipe). */
  const [order, setOrder] = useState<string[] | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [needsTap, setNeedsTap] = useState(false)
  const [refining, setRefining] = useState(false)
  const [why, setWhy] = useState<Card | null>(null)
  const [more, setMore] = useState<Card | null>(null)
  const [trailer, setTrailer] = useState<Card | null>(null)
  const [tune, setTune] = useState(false)

  const base = useMemo(
    () => Object.fromEntries(loves.map((l) => [l.qlooId.toLowerCase(), l.weight])),
    [loves],
  )
  /** How well a card fits under the weights as they are now (explainability re-rank). */
  const fitUnder = useCallback(
    (now: Record<string, number>) => (c: Card) => (c.affinity ?? 0.5) * refit(c, base, now),
    [base],
  )

  // Every card once, minus the hidden ones. Once a love's weight moves, the cards ahead are
  // re-ranked at once (the order is kept from then on; new pages are ranked among themselves).
  const cards = useMemo(() => {
    const seen = new Set<string>()
    const all = pages
      .flatMap((p) => p.cards)
      .filter((c) => !hidden.has(c.id) && !seen.has(c.id) && seen.add(c.id))
    if (!order) return all
    const byId = new Map(all.map((c) => [c.id, c]))
    const placed = order.flatMap((id) => {
      const c = byId.get(id)
      return c ? [c] : []
    })
    const inOrder = new Set(order)
    const fit = fitUnder({ ...base, ...weights })
    const rest = all.filter((c) => !inOrder.has(c.id)).sort((a, b) => fit(b) - fit(a))
    return [...placed, ...rest]
  }, [pages, hidden, order, fitUnder, base, weights])

  const card = cards[active] ?? null
  const songIndex = song.id === card?.id ? song.index : 0
  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const activeRef = useRef(active)
  activeRef.current = active

  // A love the server couldn't add (their taste is full of loves they picked) is taken back.
  const signal = useSignals((sent, result) => {
    if (!result.full) return
    const refused = new Set(sent.filter((x) => x.kind === "love").map((x) => x.qlooId))
    setLoved((s) => new Set([...s].filter((id) => !refused.has(id))))
    toast(t("full"))
  })

  const scrollTo = useCallback((index: number) => {
    const el = scroller.current
    if (!el) return
    const i = Math.max(0, Math.min(index, cardsRef.current.length))
    el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" })
  }, [])

  // Which card is on screen: the one at least 60% visible.
  const io = useRef<IntersectionObserver | null>(null)
  const observe = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    io.current ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index))
      },
      { threshold: 0.6 },
    )
    io.current.observe(el)
  }, [])
  useEffect(() => () => io.current?.disconnect(), [])

  // Back where you were.
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || !cards.length || !scroller.current) return
    restored.current = true
    if (lastActive > 0) scroller.current.scrollTop = lastActive * scroller.current.clientHeight
  }, [cards.length])

  // The card changed: seen, how long the last one held you, and the next page in good time.
  const shownAt = useRef<{ id: string; type: string; at: number } | null>(null)
  useEffect(() => {
    lastActive = active
    const now = Date.now()
    const prev = shownAt.current
    if (prev && prev.id !== card?.id && now - prev.at >= FEED.dwellMs)
      signal({ qlooId: prev.id, type: prev.type, kind: "dwell", value: now - prev.at })
    if (card && prev?.id !== card.id) {
      signal({ qlooId: card.id, type: card.type, kind: "seen" })
      shownAt.current = { id: card.id, type: card.type, at: now }
    }
    if (cards.length - active <= FEED.prefetchAt && feed.hasNextPage && !feed.isFetchingNextPage)
      void feed.fetchNextPage()
  }, [active, card, cards.length, feed, signal])

  // The card on screen drives the player (unless an episode is pinned to keep playing).
  const played = useRef<string | null>(null)
  const cardId = card?.id ?? null
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new card or song starts audio; the rest is read as it is then
  useEffect(() => {
    const current = cardsRef.current[activeRef.current]
    if (!current) return
    if (pinned && player.track?.id === pinned) return
    const track = trackOf(current, songIndex)
    if (!track) {
      if (player.playing && player.track?.pickId) player.pause()
      return
    }
    if (player.track?.id === track.id) return
    void player.play(track, queueOf(current)).then((result) => {
      if (result === "blocked") setNeedsTap(true)
      if (result === "playing" && played.current !== current.id) {
        played.current = current.id
        signal({ qlooId: current.id, type: current.type, kind: "play" })
      }
    })
  }, [cardId, songIndex])

  // Headphones and the lock screen skip cards; a preview that ends moves to the artist's next song.
  useEffect(
    () =>
      player.own({
        next: () => scrollTo(activeRef.current + 1),
        previous: () => scrollTo(activeRef.current - 1),
        ended: () => {
          const current = cardsRef.current[activeRef.current]
          if (current?.media?.kind === "songs")
            setSong((s) => ({ id: current.id, index: s.id === current.id ? s.index + 1 : 1 }))
          else scrollTo(activeRef.current + 1)
        },
      }),
    [player, scrollTo],
  )

  const start = async () => {
    if (!card) return
    const track = trackOf(card, songIndex)
    setNeedsTap(false)
    if (track) await player.play(track, queueOf(card))
  }

  const isLoved = (c: Card) => loved.has(c.id)
  const isSaved = (c: Card) => saved.get(c.id) ?? c.saved

  const love = (c: Card) => {
    const on = !isLoved(c)
    setLoved((s) => {
      const next = new Set(s)
      if (on) next.add(c.id)
      else next.delete(c.id)
      return next
    })
    sound(on ? "promote" : "tap")
    signal({
      qlooId: c.id,
      type: c.type,
      kind: on ? "love" : "unlove",
      name: c.name,
      image: c.image,
    })
    toast(on ? t("lovedToast") : t("unlovedToast"))
  }

  const save = (c: Card) => {
    const on = !isSaved(c)
    setSaved((m) => new Map(m).set(c.id, on))
    sound(on ? "place" : "tap")
    signal({
      qlooId: c.id,
      type: c.type,
      kind: on ? "save" : "unsave",
      name: c.name,
      image: c.image,
    })
  }

  const hide = (c: Card) => {
    setMore(null)
    setHidden((s) => new Set(s).add(c.id))
    signal({ qlooId: c.id, type: c.type, kind: "hide" })
    toast(t("hidden"), {
      action: {
        label: t("undo"),
        onClick: () => {
          setHidden((s) => {
            const next = new Set(s)
            next.delete(c.id)
            return next
          })
          if (meta)
            void api(`/api/people/${meta.personId}/not-for-me`, {
              method: "DELETE",
              json: { qlooId: c.id },
            })
        },
      },
    })
  }

  const share = async (c: Card) => {
    const song = c.media?.kind === "songs" ? c.media.songs[0] : null
    const url =
      song?.store ??
      (c.media?.kind === "episode" ? c.media.episode.store : null) ??
      c.links.imdb ??
      c.links.open ??
      window.location.origin
    const text = t("shareText", { name: c.name })
    try {
      if (navigator.share) await navigator.share({ title: c.name, text, url })
      else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        toast(t("copied"))
      }
    } catch {
      // The share sheet was closed.
    }
  }

  const ask = (c: Card) => {
    router.push(`/c?ask=${encodeURIComponent(t("askAbout", { name: c.name }))}`)
  }

  const togglePlay = (c: Card) => {
    const track = trackOf(c, songIndex)
    if (!track) return
    if (player.track?.id === track.id) player.toggle()
    else {
      setPinned(null)
      void player.play(track, queueOf(c))
    }
  }

  const keepPlaying = (c: Card) => {
    const track = trackOf(c, 0)
    if (!track) return
    if (pinned === track.id) {
      setPinned(null)
      return
    }
    setPinned(track.id)
    if (player.track?.id !== track.id) void player.play(track, queueOf(c))
    sound("place")
  }

  // Tuning: a category's share saves and starts the feed over; a love's weight re-ranks now and
  // asks Qloo to refine in the background.
  const shownMix = mix ?? mixOf(meta?.mix)
  const mixTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMix = (domain: keyof FeedMix, level: number) => {
    const next = { ...shownMix, [domain]: level }
    if (!Object.values(next).some((v) => v > 0)) {
      toast(t("keepOne"))
      return
    }
    setMix(next)
    if (mixTimer.current) clearTimeout(mixTimer.current)
    mixTimer.current = setTimeout(async () => {
      await api("/api/feed/mix", { method: "PUT", json: { mix: next } }).catch(() => null)
      lastActive = 0
      setActive(0)
      setOrder(null)
      scroller.current?.scrollTo({ top: 0 })
      await queryClient.resetQueries({ queryKey: qk.feed })
    }, 600)
  }

  const weightTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const refineTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onWeight = (l: FeedLove, weight: number) => {
    const now = { ...base, ...weights, [l.qlooId.toLowerCase()]: weight }
    setWeights(now)
    // Re-rank the cards ahead now; the ones behind and the one on screen stay where they are.
    const fit = fitUnder(now)
    const shown = cardsRef.current
    const ahead = shown.slice(activeRef.current + 1).sort((a, b) => fit(b) - fit(a))
    setOrder([...shown.slice(0, activeRef.current + 1), ...ahead].map((c) => c.id))
    const timers = weightTimers.current
    const pending = timers.get(l.id)
    if (pending) clearTimeout(pending)
    timers.set(
      l.id,
      setTimeout(async () => {
        if (!meta) return
        setRefining(true)
        await api(`/api/people/${meta.personId}/loves/${l.id}`, {
          method: "PATCH",
          json: { weight },
        }).catch(() => null)
        if (refineTimer.current) clearTimeout(refineTimer.current)
        refineTimer.current = setTimeout(() => setRefining(false), 8000)
      }, 700),
    )
  }

  // Keys: arrows or j/k move, space plays and pauses, l loves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [role=dialog]"))
        return
      const current = cardsRef.current[activeRef.current]
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        scrollTo(activeRef.current + 1)
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        scrollTo(activeRef.current - 1)
      } else if (e.key === " " && current) {
        e.preventDefault()
        if (needsTap) void start()
        else togglePlay(current)
      } else if (e.key === "l" && current) love(current)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (feed.isPending)
    return (
      <div className="fixed inset-0 md:start-[5.5rem]">
        <FeedCardSkeleton />
      </div>
    )
  if (feed.isError)
    return (
      <Message
        title={t("error")}
        action={
          <button
            type="button"
            onClick={() => void feed.refetch()}
            className="rounded-pill bg-white px-5 py-2.5 text-[15px] font-semibold text-black"
          >
            {t("retry")}
          </button>
        }
      />
    )
  const state = pages[0]?.state
  if (state === "empty")
    return (
      <Message
        title={t("empty")}
        action={
          <Link
            href="/start"
            className="rounded-pill bg-white px-5 py-2.5 text-[15px] font-semibold text-black"
          >
            {t("emptyCta")}
          </Link>
        }
      />
    )
  if (state === "building")
    return (
      <Message
        title={t("building")}
        action={
          <Link
            href="/me"
            className="rounded-pill bg-white px-5 py-2.5 text-[15px] font-semibold text-black"
          >
            {t("buildingCta")}
          </Link>
        }
      />
    )

  const ownsTrack = (c: Card) => player.track?.pickId === c.id

  return (
    <>
      <div
        ref={scroller}
        className="fixed inset-0 snap-y snap-mandatory overflow-y-auto overscroll-y-contain bg-black [scrollbar-width:none] md:start-[5.5rem] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((c, i) => (
          <div key={c.id} ref={observe} data-index={i} className="h-dvh snap-start snap-always">
            <FeedCard
              card={c}
              near={Math.abs(i - active) <= FEED.window}
              active={i === active}
              playing={ownsTrack(c) && player.playing}
              ownsTrack={ownsTrack(c)}
              songIndex={i === active ? songIndex : 0}
              loved={isLoved(c)}
              saved={isSaved(c)}
              pinned={Boolean(pinned && pinned === trackOf(c, 0)?.id)}
              actions={{
                love: () => love(c),
                save: () => save(c),
                hide: () => hide(c),
                why: () => setWhy(c),
                share: () => void share(c),
                ask: () => ask(c),
                togglePlay: () => togglePlay(c),
                keepPlaying: () => keepPlaying(c),
                trailer: () => {
                  player.pause()
                  setTrailer(c)
                },
                more: () => setMore(c),
              }}
            />
          </div>
        ))}
        {feed.hasNextPage ? (
          <div className="grid h-dvh snap-start place-items-center bg-black text-white/70">
            <span className="inline-flex items-center gap-2 text-[14px]">
              <Loader2 className="size-4 animate-spin" /> {t("loadingMore")}
            </span>
          </div>
        ) : (
          <div className="grid h-dvh snap-start place-items-center bg-black px-8 text-center text-white">
            <div className="flex max-w-sm flex-col items-center gap-4">
              <Orb size={96} />
              <h2 className="font-title text-[26px]">{t("end")}</h2>
              <p className="text-[15px] text-white/70">{t("endHint")}</p>
              <Link
                href="/me"
                className="rounded-pill bg-white px-5 py-2.5 text-[15px] font-semibold text-black"
              >
                {t("endCta")}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* The top bar floats over the cards. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 bg-gradient-to-b from-black/50 to-transparent pt-[env(safe-area-inset-top)] md:start-[5.5rem]">
        <div className="mx-auto flex h-14 max-w-[30rem] items-center justify-between px-4 text-white">
          <h1 className="font-title text-[20px]">{t("title")}</h1>
          <button
            type="button"
            onClick={() => setTune(true)}
            aria-label={t("tune")}
            className="pointer-events-auto grid size-10 place-items-center rounded-full bg-black/25 ring-1 ring-white/15 backdrop-blur-md hover:bg-black/40"
          >
            <SlidersHorizontal className="size-5" />
          </button>
        </div>
      </div>

      {/* One tap lets sound play for the rest of the visit (phones block audio until then). */}
      {needsTap && !player.unlocked && card && trackOf(card, 0) ? (
        <button
          type="button"
          onClick={() => void start()}
          className="fixed inset-0 z-20 grid place-items-center bg-black/35 text-white backdrop-blur-[2px] md:start-[5.5rem]"
        >
          <span className="flex max-w-xs flex-col items-center gap-4 text-center">
            <span className="relative grid place-items-center">
              <Orb size={112} working />
              <Play className="absolute size-9 translate-x-0.5 fill-white text-white" />
            </span>
            <span className="font-title text-[26px]">{t("start")}</span>
            <span className="text-[14px] text-white/75">{t("startHint")}</span>
          </span>
        </button>
      ) : null}

      <WhySheet card={why} loves={loves} onClose={() => setWhy(null)} />
      <MoreSheet
        card={more}
        onClose={() => setMore(null)}
        onWhy={() => {
          setWhy(more)
          setMore(null)
        }}
        onHide={() => more && hide(more)}
      />
      <TrailerSheet card={trailer} onClose={() => setTrailer(null)} />
      <TuneSheet
        open={tune}
        onOpenChange={setTune}
        mix={shownMix}
        onMix={onMix}
        loves={loves}
        weights={{ ...base, ...weights }}
        onWeight={onWeight}
        refining={refining}
      />
      <span className={cn("sr-only")} aria-live="polite">
        {card ? card.name : ""}
      </span>
    </>
  )
}
