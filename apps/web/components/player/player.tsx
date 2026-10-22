"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

/*
 * One player for the whole app (W5): a single <audio> element in the root providers, so what you
 * start in the feed keeps playing on every other screen, and one tap unlocks it for good (phones
 * only let audio start from a tap; after that the same element can change source freely).
 * Adapted from ElevenLabs UI's audio player (21st.dev ElevenLabs/audio-player, MIT): the playing
 * state and the clock live in separate contexts, so only progress bars re-render while it plays.
 * Added here: a queue owner (the feed) for next / previous / ended, Media Session for the lock
 * screen, and the credit each source needs (Apple previews link back to Apple Music).
 */

export type Track = {
  /** The card or episode this is, so a screen can tell its own track is the one playing. */
  id: string
  src: string
  title: string
  /** Artist, or the show for an episode. */
  by: string
  artwork: string | null
  /** Apple preview (30 seconds, credit Apple) or a podcast's own episode. */
  source: "apple" | "podcast"
  /** Where the credit links: the song on Apple Music, the show on Apple Podcasts. */
  store: string | null
  /** The pick it belongs to, for signals and "back to this card". */
  pickId?: string
  pickType?: string
}

/** Whoever drives the queue right now (the feed): what next, previous and "ended" do. */
export type QueueOwner = {
  next?: () => void
  previous?: () => void
  ended?: () => void
}

type PlayerApi = {
  track: Track | null
  playing: boolean
  buffering: boolean
  duration: number | null
  /** True once a tap has started audio; until then nothing can play on its own. */
  unlocked: boolean
  failed: boolean
  /** Plays a track (or resumes); `queue` is what follows it when no screen drives the queue. */
  play: (track?: Track, queue?: Track[]) => Promise<boolean>
  pause: () => void
  toggle: () => void
  seek: (seconds: number) => void
  stop: () => void
  /** The feed claims the queue; returns a release function. */
  own: (owner: QueueOwner) => () => void
  next: () => void
  previous: () => void
}

const PlayerContext = createContext<PlayerApi | null>(null)
const ClockContext = createContext<number>(0)

export function usePlayer() {
  const api = useContext(PlayerContext)
  if (!api) throw new Error("usePlayer needs PlayerProvider")
  return api
}

/** Seconds played of the current track; re-renders every frame while playing. */
export const usePlayerClock = () => useContext(ClockContext)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null)
  const owner = useRef<QueueOwner | null>(null)
  const queue = useRef<Track[]>([])
  const pending = useRef<Promise<void> | null>(null)
  const [track, setTrack] = useState<Track | null>(null)
  const trackRef = useRef<Track | null>(null)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [duration, setDuration] = useState<number | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [failed, setFailed] = useState(false)
  const [clock, setClock] = useState(0)

  const play = useCallback(async (next?: Track, list?: Track[]) => {
    if (list) queue.current = list
    const el = audio.current
    if (!el) return false
    if (pending.current) await pending.current.catch(() => null)
    if (next && next.src !== trackRef.current?.src) {
      trackRef.current = next
      setTrack(next)
      setFailed(false)
      setDuration(null)
      setClock(0)
      el.src = next.src
      el.load()
    } else if (next) {
      trackRef.current = next
      setTrack(next)
    }
    if (!el.src) return false
    try {
      pending.current = el.play()
      await pending.current
      setUnlocked(true)
      return true
    } catch {
      // Blocked until a tap (phones), or the source failed (the error event says which).
      return false
    } finally {
      pending.current = null
    }
  }, [])

  const pause = useCallback(() => {
    audio.current?.pause()
  }, [])

  const toggle = useCallback(() => {
    const el = audio.current
    if (!el) return
    if (el.paused) void play()
    else el.pause()
  }, [play])

  const seek = useCallback((seconds: number) => {
    const el = audio.current
    if (el && Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds)
  }, [])

  const stop = useCallback(() => {
    const el = audio.current
    if (!el) return
    el.pause()
    el.removeAttribute("src")
    el.load()
    trackRef.current = null
    setTrack(null)
    setClock(0)
    setDuration(null)
  }, [])

  const own = useCallback((next: QueueOwner) => {
    owner.current = next
    return () => {
      if (owner.current === next) owner.current = null
    }
  }, [])

  /** Without a screen driving it (you left the feed), the player walks its own queue. */
  const step = useCallback(
    (by: number) => {
      const list = queue.current
      const at = list.findIndex((t) => t.id === trackRef.current?.id)
      const target = at >= 0 ? list[at + by] : undefined
      if (target) void play(target)
    },
    [play],
  )
  const next = useCallback(() => {
    if (owner.current?.next) owner.current.next()
    else step(1)
  }, [step])
  const previous = useCallback(() => {
    if (owner.current?.previous) owner.current.previous()
    else step(-1)
  }, [step])
  const stepRef = useRef(step)
  stepRef.current = step

  // The element's own events are the truth for playing, buffering and length.
  useEffect(() => {
    const el = audio.current
    if (!el) return
    const on = {
      play: () => setPlaying(true),
      playing: () => {
        setPlaying(true)
        setBuffering(false)
      },
      pause: () => setPlaying(false),
      waiting: () => setBuffering(true),
      canplay: () => setBuffering(false),
      durationchange: () => setDuration(Number.isFinite(el.duration) ? el.duration : null),
      error: () => {
        setFailed(true)
        setBuffering(false)
        setPlaying(false)
      },
      ended: () => {
        setPlaying(false)
        if (owner.current?.ended) owner.current.ended()
        else stepRef.current(1)
      },
    }
    for (const [name, fn] of Object.entries(on)) el.addEventListener(name, fn)
    return () => {
      for (const [name, fn] of Object.entries(on)) el.removeEventListener(name, fn)
    }
  }, [])

  // The clock runs on animation frames only while playing (smooth bars, idle when paused).
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      if (audio.current) setClock(audio.current.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  // The lock screen and headphones: what's playing, and play / pause / skip / seek.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return
    const session = navigator.mediaSession
    session.metadata = track
      ? new MediaMetadata({
          title: track.title,
          artist: track.by,
          album: track.source === "apple" ? "Preview · Apple Music" : "Najimi",
          artwork: track.artwork ? [{ src: track.artwork, sizes: "600x600" }] : [],
        })
      : null
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ["play", () => void play()],
      ["pause", () => pause()],
      ["nexttrack", () => next()],
      ["previoustrack", () => previous()],
      ["seekto", (d) => d.seekTime !== undefined && seek(d.seekTime)],
      ["seekbackward", (d) => seek((audio.current?.currentTime ?? 0) - (d.seekOffset ?? 10))],
      ["seekforward", (d) => seek((audio.current?.currentTime ?? 0) + (d.seekOffset ?? 10))],
    ]
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // Not every browser supports every action.
      }
    }
  }, [track, play, pause, next, previous, seek])

  useEffect(() => {
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = track ? (playing ? "playing" : "paused") : "none"
  }, [playing, track])

  const api = useMemo<PlayerApi>(
    () => ({
      track,
      playing,
      buffering,
      duration,
      unlocked,
      failed,
      play,
      pause,
      toggle,
      seek,
      stop,
      own,
      next,
      previous,
    }),
    [
      track,
      playing,
      buffering,
      duration,
      unlocked,
      failed,
      play,
      pause,
      toggle,
      seek,
      stop,
      own,
      next,
      previous,
    ],
  )

  return (
    <PlayerContext.Provider value={api}>
      <ClockContext.Provider value={clock}>
        {/* Streamed from the source each time (Apple's terms: never stored). */}
        {/* biome-ignore lint/a11y/useMediaCaption: music previews and podcast audio carry no captions */}
        <audio ref={audio} preload="auto" className="hidden" />
        {children}
      </ClockContext.Provider>
    </PlayerContext.Provider>
  )
}

export function formatTime(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "--:--"
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`
}
