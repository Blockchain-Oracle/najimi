"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { ArrowUp, Camera, ImagePlus, Plus, Square, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { type Uploaded, uploadPhoto } from "@/lib/photo"
import { sound } from "@/lib/sounds"
import { VoiceButton } from "./voice-button"

export type ChatPerson = {
  id: string
  name: string
  identity: string
  look: string | null
  isSelf: boolean
}
export type Mode = "ask" | "auto" | "plan"

/**
 * The composer, light (after Bond's text · camera · voice composer, Refero e535dc3e): + (a photo
 * from the library or the camera) · words · mic · send. Photos are resized in the browser and
 * re-encoded on the server. Enter sends; Shift+Enter is a new line; while a turn runs, Send
 * becomes Stop. How Najimi acts (ask first, just do it) is one setting, not a switch here.
 */
export function Composer({
  person,
  busy,
  onSend,
  onStop,
  ideas = [],
  initialText,
  placeholder: placeholderText,
}: {
  /** The signed-in person (their name is in the placeholder). */
  person?: ChatPerson
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
  const [text, setText] = useState(initialText ?? "")
  const [photos, setPhotos] = useState<Uploaded[]>([])
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const input = useRef<HTMLTextAreaElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  // The placeholder rolls on while the box is empty, and stops for anyone typing.
  useEffect(() => {
    if (text || !ideas.length) return
    const timer = setInterval(() => setTick((n) => n + 1), 4000)
    return () => clearInterval(timer)
  }, [text, ideas.length])

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

  const pick = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("add")}
          title={t("add")}
          className="grid size-10 shrink-0 place-items-center rounded-full text-paper-muted transition-colors hover:bg-paper-foreground/8 hover:text-paper-foreground data-popup-open:bg-paper-foreground/8"
        >
          <Plus className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-48">
          <DropdownMenuItem onClick={() => library.current?.click()}>
            <ImagePlus /> {t("addPhoto")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => camera.current?.click()}>
            <Camera /> {t("takePhoto")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={library}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void add(e.target.files)
          e.target.value = ""
        }}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void add(e.target.files)
          e.target.value = ""
        }}
      />
    </>
  )

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dropping photos is a shortcut; the + menu is the accessible way
    <div
      className="relative flex flex-col gap-2 rounded-sheet bg-card p-1.5 text-card-foreground shadow-float outline-1 outline-transparent transition-[outline-color] duration-200 ease-glide focus-within:outline-white/20"
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
        <div className="flex gap-3 px-2 pt-2">
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
      {/* One row: + · words · mic · send. The box grows upwards; the buttons stay at its foot. */}
      <div className="flex items-end gap-1">
        {pick}
        <div className="relative min-w-0 flex-1">
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
            className="block max-h-[200px] min-h-10 w-full resize-none bg-transparent px-1.5 py-2.5 text-[15px] leading-5 outline-none"
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
                className="pointer-events-none absolute inset-x-1.5 top-2.5 truncate text-[15px] leading-5 text-paper-muted"
              >
                {shown}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
        <VoiceButton
          onText={(words) => setText((now) => (now.trim() ? `${now.trimEnd()} ${words}` : words))}
          onError={setError}
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t("stop")}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-on-ink transition-transform duration-200 active:scale-95"
          >
            <Square className="size-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            aria-label={t("send")}
            disabled={(!text.trim() && !photos.length) || uploading > 0}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-signal text-signal-foreground transition-[background-color,color,scale] duration-200 ease-glide enabled:active:scale-95 disabled:bg-raised disabled:text-text-4"
          >
            <ArrowUp className="size-5" />
          </button>
        )}
      </div>
      {error ? <p className="px-3 pb-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
