"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { ArrowUp, Hand, ImagePlus, Images, NotebookPen, Square, X, Zap } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { api } from "@/lib/fetcher"
import { type Uploaded, uploadPhoto } from "@/lib/photo"
import { sound } from "@/lib/sounds"
import { VoiceButton } from "./voice-button"

type Sample = Uploaded & { name: string }

/** Sample rooms for anyone without a photo to hand. */
function SamplePicker({ onPick }: { onPick: (sample: Uploaded) => void }) {
  const t = useTranslations("Chat")
  const samples = useQuery({
    queryKey: ["samples"],
    queryFn: () => api<{ samples: Sample[] }>("/api/samples"),
    staleTime: Number.POSITIVE_INFINITY,
  })
  if (!samples.data?.samples.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("sample")}
        title={t("sample")}
        className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 text-sm text-paper-muted hover:bg-paper-foreground/8"
      >
        <Images className="size-4" />{" "}
        <span className="hidden whitespace-nowrap sm:inline">{t("sample")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-72 p-2">
        <p className="px-1 pb-2 text-xs text-muted-foreground">{t("sampleHint")}</p>
        <div className="grid grid-cols-3 gap-2">
          {samples.data.samples.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => onPick(s)}
              className="flex-col items-stretch gap-1 p-1"
            >
              {/* biome-ignore lint/performance/noImgElement: a shipped sample photo */}
              <img src={s.url} alt="" className="aspect-[3/2] w-full rounded-sm object-cover" />
              <span className="text-center text-[11px]">
                {t(`samples.${s.name}` as "samples.living")}
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type ChatPerson = {
  id: string
  name: string
  identity: string
  look: string | null
  isSelf: boolean
}
export type Mode = "ask" | "auto" | "plan"

const MODES = [
  { mode: "ask", icon: Hand },
  { mode: "auto", icon: Zap },
  { mode: "plan", icon: NotebookPen },
] as const

/**
 * The composer: words and photos (resized in the browser, re-encoded on the server) and the mode.
 * Enter sends; Shift+Enter is a new line; while a turn runs, Send becomes Stop.
 */
export function Composer({
  person,
  mode,
  onMode,
  busy,
  onSend,
  onStop,
  ideas = [],
  initialText,
  placeholder: placeholderText,
}: {
  /** The signed-in person (their face sits on the composer). */
  person?: ChatPerson
  mode: Mode
  onMode: (mode: Mode) => void
  busy: boolean
  onSend: (text: string, photos: Uploaded[]) => void
  onStop: () => void
  /** Things worth asking, shown in turn where the placeholder sits. */
  ideas?: string[]
  /** Text already typed in when the composer opens. */
  initialText?: string
  /** What the empty box says (rooms with people say how to call Najimi). */
  placeholder?: string
}) {
  const t = useTranslations("Chat")
  const ts = useTranslations("Settings")
  const [text, setText] = useState(initialText ?? "")
  const [photos, setPhotos] = useState<Uploaded[]>([])
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [hint, setHint] = useState<Mode | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const uid = useId()

  // The placeholder rolls on while the box is empty, and stops for anyone typing.
  useEffect(() => {
    if (text || !ideas.length) return
    const timer = setInterval(() => setTick((n) => n + 1), 4000)
    return () => clearInterval(timer)
  }, [text, ideas.length])

  // A mode's one-line explanation shows for a moment after it's picked.
  useEffect(() => {
    if (!hint) return
    const timer = setTimeout(() => setHint(null), 4500)
    return () => clearTimeout(timer)
  }, [hint])

  const pickMode = (next: Mode) => {
    if (next === mode) return
    sound("tap")
    onMode(next)
    setHint(next)
  }

  async function add(files: FileList | File[] | null) {
    setError(null)
    for (const file of Array.from(files ?? []).slice(0, 4 - photos.length)) {
      setUploading((n) => n + 1)
      try {
        const up = await uploadPhoto(file)
        setPhotos((p) => [...p, up])
      } catch (e) {
        setError(e instanceof Error ? e.message : "")
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const send = () => {
    const words = text.trim()
    if ((!words && !photos.length) || busy || uploading) return
    sound("place")
    onSend(words, photos)
    setText("")
    setPhotos([])
    input.current?.style.setProperty("height", "auto")
  }

  const placeholder = placeholderText ?? t("placeholder", { name: person?.name ?? "" })
  const lines = [placeholder, ...ideas]
  const shown = lines[tick % lines.length]

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dropping photos is a shortcut; the photo button is the accessible way
    <div
      className="relative flex flex-col gap-2 rounded-sheet bg-card p-2.5 text-card-foreground shadow-float outline-1 outline-transparent transition-[outline-color] duration-200 ease-glide focus-within:outline-white/20"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void add(e.dataTransfer.files)
      }}
    >
      {/* While Najimi works, a thin signal line along the top edge: the only colour it wears. */}
      {busy ? (
        <span
          aria-hidden
          className="absolute inset-x-8 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-signal to-transparent"
        />
      ) : null}
      {photos.length || uploading ? (
        // Photos sit like prints laid on the table, each at its own slight angle.
        <div className="flex gap-3 px-1.5 pt-1.5">
          <AnimatePresence initial={false}>
            {photos.map((p) => (
              <motion.span
                key={p.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                {/* biome-ignore lint/performance/noImgElement: a private, session-checked photo */}
                <img
                  src={p.url}
                  alt=""
                  className="size-14 rounded-tile object-cover shadow-sticker"
                />
                <button
                  type="button"
                  aria-label={t("removePhoto")}
                  onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))}
                  className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-on-ink"
                >
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          {Array.from({ length: uploading }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
            <span key={i} className="size-14 animate-pulse rounded-tile bg-raised" />
          ))}
        </div>
      ) : null}
      <div className="relative">
        <textarea
          ref={input}
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = "auto"
            e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files).filter((f) =>
              f.type.startsWith("image/"),
            )
            if (files.length) void add(files)
          }}
          aria-label={placeholder}
          className="block max-h-[200px] min-h-11 w-full resize-none bg-transparent px-2.5 py-2 text-[15px] outline-none"
        />
        {/* The placeholder, and between turns a few things worth asking, rolling past. */}
        {text ? null : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={shown}
              aria-hidden
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none absolute inset-x-2.5 top-2 truncate text-[15px] text-paper-muted"
            >
              {shown}
            </motion.span>
          </AnimatePresence>
        )}
      </div>
      {error ? <p className="px-2 text-xs text-destructive">{error}</p> : null}
      <AnimatePresence>
        {hint ? (
          <motion.p
            key={hint}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-2.5 text-xs text-paper-muted"
            aria-live="polite"
          >
            {t(`modeHints.${hint}`)}
          </motion.p>
        ) : null}
      </AnimatePresence>
      {/* Controls wrap onto a second line on a narrow phone or in a longer language; voice and
          send stay together on the right and never shrink. */}
      <div className="flex items-end gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <label className="grid size-9 cursor-pointer place-items-center rounded-full text-paper-muted transition-colors hover:bg-paper-foreground/8 hover:text-paper-foreground">
            <ImagePlus className="size-5" />
            <span className="sr-only">{t("addPhoto")}</span>
            <input
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              className="sr-only"
              onChange={(e) => {
                void add(e.target.files)
                e.target.value = ""
              }}
            />
          </label>
          {photos.length === 0 ? (
            <SamplePicker onPick={(sample) => setPhotos((p) => [...p, sample])} />
          ) : null}
          {/* The mode as a switch: the one in use names itself, the others are a tap away. */}
          <fieldset className="flex items-center rounded-pill bg-raised p-0.5 shadow-sticker">
            <legend className="sr-only">{ts("mode")}</legend>
            {MODES.map(({ mode: m, icon: Icon }) => {
              const on = m === mode
              return (
                <label
                  key={m}
                  title={t(`modeHints.${m}`)}
                  className={cn(
                    "relative flex h-8 cursor-pointer items-center rounded-pill px-2 text-[13px] font-medium whitespace-nowrap transition-colors has-focus-visible:outline-2 has-focus-visible:outline-signal",
                    on ? "text-foreground" : "text-text-3 hover:text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name={`mode-${uid}`}
                    value={m}
                    checked={on}
                    onChange={() => pickMode(m)}
                    className="sr-only"
                  />
                  {on ? (
                    <motion.span
                      layoutId={`mode-${uid}`}
                      className="absolute inset-0 rounded-pill bg-card shadow-sticker-lift"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ) : null}
                  <Icon className="relative size-4 shrink-0" />
                  <AnimatePresence initial={false}>
                    {on ? (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="relative overflow-hidden ps-1.5"
                      >
                        {t(`modesShort.${m}`)}
                      </motion.span>
                    ) : (
                      <span className="sr-only">{t(`modesShort.${m}`)}</span>
                    )}
                  </AnimatePresence>
                </label>
              )
            })}
          </fieldset>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <VoiceButton
            onText={(words) => setText((now) => (now.trim() ? `${now.trimEnd()} ${words}` : words))}
            onError={setError}
          />
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={t("stop")}
              className="grid size-10 place-items-center rounded-full bg-ink text-on-ink transition-transform duration-200 active:scale-95"
            >
              <Square className="size-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              aria-label={t("send")}
              disabled={(!text.trim() && !photos.length) || uploading > 0}
              className="grid size-10 place-items-center rounded-full bg-signal text-signal-foreground transition-[background-color,color,scale] duration-200 ease-glide enabled:active:scale-95 disabled:bg-raised disabled:text-text-4"
            >
              <ArrowUp className="size-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
