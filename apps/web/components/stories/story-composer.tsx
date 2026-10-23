"use client"

import type { StorySong, StoryThing } from "@najimi/db/schema"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Camera,
  Images,
  Loader2,
  type LucideIcon,
  Map as MapIcon,
  Music2,
  Sparkles,
  Star,
  X,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/fetcher"
import { uploadPhoto } from "@/lib/photo"
import { StoryContent, type StoryShape } from "./story-content"

/*
 * A new story, in two steps: what it is (a photo or video from the library or the camera, a song
 * from your taste, one of your picks, a plan, a Wrapped slide), then the story as it'll show, with
 * a caption (and, on a photo, a song that plays with it).
 */

type Song = StorySong & { thing: StoryThing }
type Options = {
  songs: Song[]
  picks: StoryThing[]
  plans: { token: string; title: string; city: string | null; image: string | null }[]
  wrapped: string | null
}

type Draft =
  | { kind: "photo"; uploadId: string; src: string; song: Song | null }
  | { kind: "video"; file: File; src: string }
  | { kind: "song"; song: Song }
  | { kind: "pick"; thing: StoryThing }
  | { kind: "plan"; plan: Options["plans"][number] }
  | { kind: "wrapped"; token: string; slide: number }

type Step = "start" | "song" | "pick" | "plan" | "wrapped" | "songOnPhoto"

const shapeOf = (d: Draft, caption: string): StoryShape => ({
  kind: d.kind,
  status: "ready",
  caption: caption.trim() || null,
  media:
    d.kind === "photo"
      ? { src: d.src, poster: null, video: false }
      : d.kind === "video"
        ? { src: d.src, poster: null, video: true }
        : { src: null, poster: null, video: false },
  song: d.kind === "song" ? d.song : d.kind === "photo" ? d.song : null,
  thing: d.kind === "pick" ? d.thing : d.kind === "song" ? d.song.thing : null,
  plan: d.kind === "plan" ? d.plan : null,
  wrapped: d.kind === "wrapped" ? { token: d.token, slide: d.slide } : null,
})

export function StoryComposer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Stories")
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>("start")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState<null | "reading" | "posting">(null)
  const library = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const options = useQuery({
    queryKey: ["stories", "options"],
    queryFn: () => api<Options>("/api/stories/options"),
    staleTime: 5 * 60_000,
  })
  const o = options.data

  // A video's preview is a local file: let it go with the composer.
  useEffect(
    () => () => {
      if (draft?.kind === "video") URL.revokeObjectURL(draft.src)
    },
    [draft],
  )

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    if (file.type.startsWith("video/")) {
      setDraft({ kind: "video", file, src: URL.createObjectURL(file) })
      return
    }
    setBusy("reading")
    try {
      const up = await uploadPhoto(file)
      setDraft({ kind: "photo", uploadId: up.id, src: up.url, song: null })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    } finally {
      setBusy(null)
    }
  }

  const post = async () => {
    if (!draft || busy) return
    setBusy("posting")
    try {
      const text = caption.trim() || undefined
      let payload: Record<string, unknown>
      if (draft.kind === "video") {
        const form = new FormData()
        form.set("file", draft.file)
        const res = await fetch("/api/stories/video", { method: "POST", body: form })
        const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
        if (!res.ok || !body.id) throw new Error(body.error ?? t("uploadFailed"))
        payload = { kind: "video", uploadId: body.id, caption: text }
      } else if (draft.kind === "photo") {
        const { thing: _t, ...song } = draft.song ?? ({} as Song)
        payload = {
          kind: "photo",
          uploadId: draft.uploadId,
          caption: text,
          ...(draft.song ? { song } : {}),
        }
      } else if (draft.kind === "song") {
        const { thing, ...song } = draft.song
        payload = { kind: "song", song, thing, caption: text }
      } else if (draft.kind === "pick")
        payload = { kind: "pick", thing: draft.thing, caption: text }
      else if (draft.kind === "plan")
        payload = { kind: "plan", planToken: draft.plan.token, caption: text }
      else
        payload = { kind: "wrapped", wrappedToken: draft.token, slide: draft.slide, caption: text }
      await api("/api/stories", { json: payload })
      await queryClient.invalidateQueries({ queryKey: ["stories"] })
      toast(draft.kind === "video" ? t("postedVideo") : t("posted"))
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    } finally {
      setBusy(null)
    }
  }

  const Tile = ({
    icon: Icon,
    label,
    onClick,
    disabled,
  }: {
    icon: LucideIcon
    label: string
    onClick: () => void
    disabled?: boolean
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex aspect-square flex-col items-center justify-center gap-2.5 rounded-card bg-white/[0.06] text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.1] disabled:opacity-40"
    >
      <span className="grid size-12 place-items-center rounded-full bg-white/10">
        <Icon className="size-6" />
      </span>
      {label}
    </button>
  )

  const back = () => {
    if (step === "songOnPhoto") return setStep("start")
    if (draft && step === "start") return setDraft(null)
    setStep("start")
  }

  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black text-white [color-scheme:dark]">
      <div className="relative flex aspect-[9/16] h-full max-h-dvh w-auto max-w-full flex-col overflow-hidden md:rounded-[22px]">
        {draft && step !== "songOnPhoto" ? (
          // The story as it'll show, with the caption typed straight onto it.
          <>
            <StoryContent story={shapeOf(draft, caption)} />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={back}
                aria-label={t("back")}
                className="grid size-10 place-items-center rounded-full bg-black/45 backdrop-blur-md"
              >
                <ArrowLeft className="size-5" />
              </button>
              {draft.kind === "photo" ? (
                <button
                  type="button"
                  onClick={() => setStep("songOnPhoto")}
                  className="flex h-10 items-center gap-2 rounded-pill bg-black/45 px-4 text-[14px] font-semibold backdrop-blur-md"
                >
                  <Music2 className="size-4" /> {draft.song ? t("changeSong") : t("addSong")}
                </button>
              ) : null}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-3 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 140))}
                placeholder={t("captionPlaceholder")}
                aria-label={t("caption")}
                className="h-12 w-full rounded-pill bg-black/45 px-4 text-[15px] ring-1 ring-white/25 outline-none backdrop-blur-md placeholder:text-white/70"
              />
              <button
                type="button"
                onClick={() => void post()}
                disabled={busy !== null}
                className="flex h-12 items-center justify-center gap-2 rounded-pill bg-white text-[15px] font-semibold text-black disabled:opacity-70"
              >
                {busy === "posting" ? <Loader2 className="size-4 animate-spin" /> : null}
                {busy === "posting"
                  ? draft.kind === "video"
                    ? t("uploading")
                    : t("posting")
                  : t("post")}
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col bg-[#0d0c12]">
            <header className="flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
              {step !== "start" ? (
                <button
                  type="button"
                  onClick={back}
                  aria-label={t("back")}
                  className="grid size-10 place-items-center rounded-full bg-white/10"
                >
                  <ArrowLeft className="size-5" />
                </button>
              ) : null}
              <h2 className="flex-1 font-title text-[1.6rem] leading-none">
                {step === "start" ? t("new") : t(`steps.${step}`)}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="grid size-10 place-items-center rounded-full bg-white/10"
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              {step === "start" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Tile
                    icon={Images}
                    label={t("library")}
                    onClick={() => library.current?.click()}
                    disabled={busy !== null}
                  />
                  <Tile
                    icon={Camera}
                    label={t("camera")}
                    onClick={() => camera.current?.click()}
                    disabled={busy !== null}
                  />
                  <Tile
                    icon={Music2}
                    label={t("song")}
                    onClick={() => setStep("song")}
                    disabled={!o?.songs.length}
                  />
                  <Tile
                    icon={Star}
                    label={t("pick")}
                    onClick={() => setStep("pick")}
                    disabled={!o?.picks.length}
                  />
                  <Tile
                    icon={MapIcon}
                    label={t("plan")}
                    onClick={() => setStep("plan")}
                    disabled={!o?.plans.length}
                  />
                  <Tile
                    icon={Sparkles}
                    label={t("wrapped")}
                    onClick={() => setStep("wrapped")}
                    disabled={!o?.wrapped}
                  />
                  {busy === "reading" ? (
                    <p className="col-span-2 flex items-center justify-center gap-2 text-[14px] text-white/70">
                      <Loader2 className="size-4 animate-spin" /> {t("reading")}
                    </p>
                  ) : null}
                  <input
                    ref={library}
                    type="file"
                    accept="image/*,.heic,.heif,video/mp4,video/quicktime,video/webm"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      void pickFile(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                  <input
                    ref={camera}
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      void pickFile(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                </div>
              ) : step === "song" || step === "songOnPhoto" ? (
                <SongList
                  songs={o?.songs ?? []}
                  onPick={(song) => {
                    if (step === "songOnPhoto" && draft?.kind === "photo")
                      setDraft({ ...draft, song })
                    else setDraft({ kind: "song", song })
                    setStep("start")
                  }}
                />
              ) : step === "pick" ? (
                <ul className="grid grid-cols-3 gap-3">
                  {(o?.picks ?? []).map((p) => (
                    <li key={p.qlooId}>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({ kind: "pick", thing: p })
                          setStep("start")
                        }}
                        className="flex w-full flex-col gap-1.5 text-start"
                      >
                        {p.image ? (
                          // biome-ignore lint/performance/noImgElement: remote artwork
                          <img
                            src={p.image}
                            alt=""
                            className="aspect-square w-full rounded-tile object-cover"
                          />
                        ) : (
                          <span className="aspect-square w-full rounded-tile bg-white/10" />
                        )}
                        <span className="line-clamp-2 text-[12px] font-semibold">{p.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : step === "plan" ? (
                <ul className="flex flex-col gap-2">
                  {(o?.plans ?? []).map((p) => (
                    <li key={p.token}>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({ kind: "plan", plan: p })
                          setStep("start")
                        }}
                        className="flex w-full items-center gap-3 rounded-card bg-white/[0.06] p-2.5 text-start hover:bg-white/[0.1]"
                      >
                        {p.image ? (
                          // biome-ignore lint/performance/noImgElement: remote artwork
                          <img src={p.image} alt="" className="size-14 rounded-tile object-cover" />
                        ) : (
                          <span className="size-14 rounded-tile bg-white/10" />
                        )}
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[15px] font-semibold">{p.title}</span>
                          {p.city ? (
                            <span className="text-[13px] text-white/60">{p.city}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : o?.wrapped ? (
                <ul className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <li key={n}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!o.wrapped) return
                          setDraft({ kind: "wrapped", token: o.wrapped, slide: n })
                          setStep("start")
                        }}
                        className="block w-full overflow-hidden rounded-tile"
                      >
                        {/* biome-ignore lint/performance/noImgElement: our own generated slide */}
                        <img
                          src={`/api/og/wrapped/${o.wrapped}/${n}`}
                          alt=""
                          className="aspect-[9/16] w-full object-cover"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Songs from your taste, each a tap to hear (its preview) and a tap to choose. */
function SongList({ songs, onPick }: { songs: Song[]; onPick: (song: Song) => void }) {
  const t = useTranslations("Stories")
  const [hearing, setHearing] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  return (
    <ul className="flex flex-col gap-1">
      {/* biome-ignore lint/a11y/useMediaCaption: a song preview */}
      <audio ref={audio} onEnded={() => setHearing(null)} />
      {songs.map((s) => (
        <li key={s.preview} className="flex items-center gap-3 rounded-tile px-1 py-1.5">
          <button
            type="button"
            onClick={() => {
              const el = audio.current
              if (!el) return
              if (hearing === s.preview) {
                el.pause()
                setHearing(null)
              } else {
                el.src = s.preview
                void el.play()
                setHearing(s.preview)
              }
            }}
            aria-label={t("listen")}
            className={cn(
              "relative size-12 shrink-0 overflow-hidden rounded-[10px]",
              hearing === s.preview && "ring-2 ring-[var(--color-aura-1)]",
            )}
          >
            {s.artwork ? (
              // biome-ignore lint/performance/noImgElement: Apple artwork
              <img src={s.artwork} alt="" className="size-full object-cover" />
            ) : (
              <Music2 className="m-auto size-5" />
            )}
          </button>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold">{s.title}</span>
            <span className="truncate text-[13px] text-white/60">{s.artist}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              audio.current?.pause()
              onPick(s)
            }}
            className="h-9 shrink-0 rounded-pill bg-white px-4 text-[13px] font-semibold text-black"
          >
            {t("use")}
          </button>
        </li>
      ))}
    </ul>
  )
}
