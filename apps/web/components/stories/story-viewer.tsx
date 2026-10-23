"use client"

import { STORIES } from "@najimi/config"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowUpRight,
  Eye,
  Heart,
  MoreHorizontal,
  Music2,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import Link from "next/link"
import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { useEntity } from "@/components/entity/entity-provider"
import { ProfileLink } from "@/components/people/profile-link"
import { usePlayer } from "@/components/player/player"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import type { StoryCard, TrayPerson } from "@/lib/stories"
import { StoryContent } from "./story-content"

/*
 * Stories, played: one person after another, each story full-bleed under thin segment bars, the
 * name, the time and (for a song) what's playing; tap right for the next, left for the one before,
 * hold to pause, swipe down to close. Others' stories end in a reply field and reactions (both land
 * in your DM with them); your own show who saw them. After Bond's bare viewer (Refero 8660fa72)
 * and TikTok's music line in the header (18d0112f).
 */

const STILL_MS = 6000
const SONG_MS = 15000
const HOLD_MS = 180

export type Viewing = { people: TrayPerson[]; index: number }

export function StoryViewer({
  viewing,
  me,
  onClose,
}: {
  viewing: Viewing
  me: string | null
  onClose: () => void
}) {
  const [pi, setPi] = useState(viewing.index)
  const person = viewing.people[pi]
  const goPerson = (next: number) => {
    if (next < 0) return
    if (next >= viewing.people.length) onClose()
    else setPi(next)
  }
  if (!person) return null
  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black [color-scheme:dark]">
      <PersonStories
        key={person.userId}
        person={person}
        me={me}
        onClose={onClose}
        onPrevPerson={() => goPerson(pi - 1)}
        onNextPerson={() => goPerson(pi + 1)}
      />
    </div>
  )
}

function PersonStories({
  person,
  me,
  onClose,
  onPrevPerson,
  onNextPerson,
}: {
  person: TrayPerson
  me: string | null
  onClose: () => void
  onPrevPerson: () => void
  onNextPerson: () => void
}) {
  const t = useTranslations("Stories")
  const format = useFormatter()
  const queryClient = useQueryClient()
  const player = usePlayer()
  const entity = useEntity()
  const mine = person.userId === me
  const list = useQuery({
    queryKey: ["stories", "of", person.userId],
    queryFn: () => api<{ stories: StoryCard[] }>(`/api/stories/of/${person.userId}`),
    staleTime: 15_000,
  })
  const stories = list.data?.stories ?? []
  // Start at the first one they haven't seen (all seen: from the start).
  const [si, setSi] = useState<number | null>(null)
  useEffect(() => {
    if (si !== null || !stories.length) return
    const first = stories.findIndex((s) => !s.seen)
    setSi(first === -1 || mine ? 0 : first)
  }, [stories, si, mine])
  const story = si === null ? undefined : stories[si]

  const [progress, setShown] = useState(0)
  // Where a paused story resumes; reset (before the clock reads it) whenever the story changes.
  const at = useRef(0)
  const setProgress = (p: number) => {
    at.current = p
    setShown(p)
  }
  const [held, setHeld] = useState(false)
  const [typing, setTyping] = useState(false)
  const [viewers, setViewers] = useState(false)
  const [menu, setMenu] = useState(false)
  const [videoMs, setVideoMs] = useState<number | null>(null)
  // Sound is on unless the browser won't start it without a tap: then muted, with a button.
  const [muted, setMuted] = useState(false)
  const paused = held || typing || viewers || menu
  const audio = useRef<HTMLAudioElement>(null)
  const video = useRef<HTMLVideoElement>(null)

  // Their music stops while stories play (a story with a song plays its own).
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on open
  useEffect(() => {
    player.pause()
  }, [])

  const next = useCallback(() => {
    if (si === null) return
    if (si + 1 < stories.length) setSi(si + 1)
    else onNextPerson()
  }, [si, stories.length, onNextPerson])
  const prev = useCallback(() => {
    if (si === null) return
    if (si > 0) setSi(si - 1)
    else onPrevPerson()
  }, [si, onPrevPerson])

  // A new story: from the start, marked seen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: per story
  useEffect(() => {
    setProgress(0)
    setVideoMs(null)
    if (!story || mine || story.seen) return
    void api(`/api/stories/${story.id}/view`, { json: {} }).catch(() => null)
    queryClient.setQueryData<{ stories: StoryCard[] }>(["stories", "of", person.userId], (d) =>
      d ? { stories: d.stories.map((s) => (s.id === story.id ? { ...s, seen: true } : s)) } : d,
    )
  }, [story?.id])

  const duration =
    story?.kind === "video" && story.status === "ready"
      ? (videoMs ?? 60_000)
      : story?.kind === "song"
        ? SONG_MS
        : STILL_MS

  // The bar fills as it plays; a pause holds it (and the video and the song) where it is.
  // biome-ignore lint/correctness/useExhaustiveDependencies: progress resumes where a pause left off
  useEffect(() => {
    if (!story || paused) {
      video.current?.pause()
      audio.current?.pause()
      return
    }
    const start = (el: HTMLMediaElement | null) =>
      el?.play().catch(() => {
        el.muted = true
        setMuted(true)
        return el.play().catch(() => null)
      })
    void start(video.current)
    void start(audio.current)
    // A video keeps its own time; everything else runs on the clock.
    if (story.kind === "video" && story.status === "ready") return
    const startAt = performance.now() - at.current * duration
    let raf = 0
    const step = (now: number) => {
      const p = (now - startAt) / duration
      if (p >= 1) return next()
      setProgress(p)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [story?.id, paused, duration, next])

  useEffect(() => {
    if (video.current) video.current.muted = muted
    if (audio.current) audio.current.muted = muted
  })

  // A video's bar follows the video itself.
  useEffect(() => {
    const el = video.current
    if (!el) return
    const tick = () => setProgress(el.duration ? el.currentTime / el.duration : 0)
    el.addEventListener("timeupdate", tick)
    return () => el.removeEventListener("timeupdate", tick)
  })

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing) return
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [next, prev, onClose, typing])

  // Tap left third: back; elsewhere: on. Hold: pause. Swipe down: close.
  const press = useRef<{ x: number; y: number; at: number; timer: number } | null>(null)
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const timer = window.setTimeout(() => setHeld(true), HOLD_MS)
    press.current = { x: e.clientX, y: e.clientY, at: performance.now(), timer }
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current
    press.current = null
    if (!p) return
    window.clearTimeout(p.timer)
    const wasHeld = held
    setHeld(false)
    if (e.clientY - p.y > 90) return onClose()
    if (wasHeld || performance.now() - p.at > HOLD_MS) return
    const box = e.currentTarget.getBoundingClientRect()
    if (e.clientX - box.left < box.width / 3) prev()
    else next()
  }

  const react = async (reaction: string) => {
    if (!story) return
    await api(`/api/stories/${story.id}/view`, { json: { reaction } }).catch(() => null)
    toast(t("sentReaction", { reaction, name: person.name }))
  }
  const [reply, setReply] = useState("")
  const sendReply = async () => {
    const text = reply.trim()
    if (!story || !text) return
    setReply("")
    try {
      await api(`/api/stories/${story.id}/reply`, { json: { text } })
      toast(t("sentReply", { name: person.name }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    }
  }
  const remove = async () => {
    if (!story) return
    setMenu(false)
    await api(`/api/stories/${story.id}`, { method: "DELETE" }).catch(() => null)
    await queryClient.invalidateQueries({ queryKey: ["stories"] })
    if (stories.length <= 1) onClose()
  }

  const ago = story ? format.relativeTime(new Date(story.createdAt), Date.now()) : ""
  const song = story?.song

  return (
    <div className="relative aspect-[9/16] h-full max-h-dvh w-auto max-w-full select-none overflow-hidden md:rounded-[22px]">
      {/* The whole frame is the story's tap surface (arrow keys and Escape work too). */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => setHeld(false)}
      >
        {story ? (
          <StoryContent
            story={story}
            videoRef={video}
            onVideoReady={(s) => setVideoMs(Math.min(STORIES.video.maxSeconds, s) * 1000)}
            onVideoEnd={next}
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />
        )}
      </div>
      {song ? (
        // biome-ignore lint/a11y/useMediaCaption: a song preview; its credit is on screen
        <audio key={story?.id} ref={audio} src={song.preview} autoPlay />
      ) : null}

      {/* Bars, who, when, and what's playing. */}
      <header
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 bg-gradient-to-b from-black/55 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 transition-opacity",
          held && "opacity-0",
        )}
      >
        <div className="flex gap-1">
          {stories.map((s, i) => (
            <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full rounded-full bg-white"
                style={{
                  width: `${si === null ? 0 : i < si ? 100 : i === si ? Math.round(progress * 100) : 0}%`,
                }}
              />
            </span>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center gap-2.5">
          <Face look={person.look} name={person.name} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-[14px] font-semibold text-white">
                {mine ? t("yourStory") : person.name}
              </span>
              <span className="shrink-0 text-[12px] text-white/65">{ago}</span>
            </span>
            {song ? (
              <a
                href={song.store}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-1 text-[12px] text-white/80"
              >
                <Music2 className="size-3 shrink-0" />
                <span className="truncate">
                  {song.artist} · {song.title}
                </span>
              </a>
            ) : null}
          </span>
          {story?.song || (story?.kind === "video" && story.status === "ready") ? (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? t("soundOn") : t("soundOff")}
              className="grid size-9 place-items-center rounded-full text-white"
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
          ) : null}
          {mine ? (
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-label={t("more")}
              className="grid size-9 place-items-center rounded-full text-white"
            >
              <MoreHorizontal className="size-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid size-9 place-items-center rounded-full text-white"
          >
            <X className="size-6" />
          </button>
        </div>
        {menu ? (
          <div className="pointer-events-auto ms-auto w-48 overflow-hidden rounded-tile bg-[#1c1c1f] shadow-float ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => void remove()}
              className="flex w-full items-center gap-2 px-3.5 py-3 text-start text-[14px] font-semibold text-[#FF6B7A] hover:bg-white/5"
            >
              <Trash2 className="size-4" /> {t("delete")}
            </button>
          </div>
        ) : null}
      </header>

      {/* Reply and react to theirs; see who saw yours. */}
      <footer
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col gap-3 px-3 pt-6 pb-[max(0.85rem,env(safe-area-inset-bottom))] transition-opacity",
          held && "opacity-0",
        )}
      >
        {/* What the story is about opens like a link sticker. */}
        {story?.plan ? (
          <Link
            href={`/plan/${story.plan.token}`}
            onClick={onClose}
            className="mx-auto flex h-10 items-center gap-1.5 rounded-pill bg-white px-4 text-[14px] font-semibold text-black shadow-float"
          >
            {t("openPlan")} <ArrowUpRight className="size-4" />
          </Link>
        ) : story?.thing ? (
          <button
            type="button"
            onClick={() => {
              const thing = story.thing
              if (!thing) return
              onClose()
              entity.open(thing, { surface: "room" })
            }}
            className="mx-auto flex h-10 max-w-[80%] items-center gap-1.5 rounded-pill bg-white px-4 text-[14px] font-semibold text-black shadow-float"
          >
            <span className="truncate">{t("openThing", { name: story.thing.name })}</span>
            <ArrowUpRight className="size-4 shrink-0" />
          </button>
        ) : null}
        {mine ? (
          <button
            type="button"
            onClick={() => setViewers(true)}
            className="flex w-fit items-center gap-2 rounded-pill bg-black/45 px-3.5 py-2 text-[14px] font-semibold text-white backdrop-blur-md"
          >
            <Eye className="size-4" /> {t("seenBy", { n: story?.views ?? 0 })}
          </button>
        ) : (
          <>
            {typing ? (
              <div className="flex justify-between px-2">
                {STORIES.reactions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => void react(r)}
                    className="text-[28px] transition-transform active:scale-125"
                  >
                    {r}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void sendReply()
              }}
            >
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value.slice(0, 1000))}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                placeholder={t("replyTo", { name: person.name })}
                className="h-12 min-w-0 flex-1 rounded-pill bg-black/45 px-4 text-[15px] text-white ring-1 ring-white/25 outline-none backdrop-blur-md placeholder:text-white/70"
              />
              {reply.trim() ? (
                <button
                  type="submit"
                  onPointerDown={(e) => e.preventDefault()}
                  aria-label={t("send")}
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-black"
                >
                  <Send className="size-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void react("❤️")}
                  aria-label={t("love")}
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/25 backdrop-blur-md"
                >
                  <Heart className={cn("size-5", story?.reaction === "❤️" && "fill-current")} />
                </button>
              )}
            </form>
          </>
        )}
      </footer>

      {viewers && story ? (
        <ViewersPanel storyId={story.id} onClose={() => setViewers(false)} />
      ) : null}
    </div>
  )
}

type Viewer = {
  userId: string
  name: string
  look: string | null
  username: string | null
  reaction: string | null
  at: string
}

/** Who saw your story, newest first, with how they reacted (after WhatsApp's viewers sheet). */
function ViewersPanel({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const t = useTranslations("Stories")
  const format = useFormatter()
  const viewers = useQuery({
    queryKey: ["stories", "viewers", storyId],
    queryFn: () => api<{ viewers: Viewer[] }>(`/api/stories/${storyId}/viewers`),
  })
  const list = viewers.data?.viewers ?? []
  return (
    <div className="absolute inset-x-0 bottom-0 flex max-h-[55%] flex-col rounded-t-sheet bg-[#121214] pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-float">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3 className="text-[15px] font-semibold">{t("seenBy", { n: list.length })}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid size-8 place-items-center rounded-full bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
      <ul className="flex flex-col overflow-y-auto px-3">
        {list.map((v) => (
          <li key={v.userId}>
            <ProfileLink
              username={v.username}
              className="flex items-center gap-3 rounded-tile px-2 py-2 hover:bg-white/5"
            >
              <Face look={v.look} name={v.name} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold">{v.name}</span>
                <span className="text-[12px] text-white/55">
                  {format.dateTime(new Date(v.at), { hour: "numeric", minute: "2-digit" })}
                </span>
              </span>
              {v.reaction ? <span className="text-[22px]">{v.reaction}</span> : null}
            </ProfileLink>
          </li>
        ))}
        {viewers.isSuccess && !list.length ? (
          <li className="px-2 py-4 text-[14px] text-white/60">{t("noViewers")}</li>
        ) : null}
      </ul>
    </div>
  )
}
