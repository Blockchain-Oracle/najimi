"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { ArrowUp, Check, ChevronDown, ImagePlus, Images, Square, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { WORKFLOW_LOOK, WORKFLOW_SLUGS } from "@/components/workflows/workflow-meta"
import { api } from "@/lib/fetcher"
import { type Uploaded, uploadPhoto } from "@/lib/photo"
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
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 text-sm text-paper-muted hover:bg-paper-foreground/8">
        <Images className="size-4" />{" "}
        <span className="hidden whitespace-nowrap xl:inline">{t("sample")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-2">
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

export type ChatPerson = { id: string; name: string; identity: string; isSelf: boolean }
export type Mode = "ask" | "auto" | "plan"

const DOT: Record<string, string> = {
  violet: "bg-violet",
  pink: "bg-pink",
  cobalt: "bg-cobalt",
  orange: "bg-orange",
  teal: "bg-teal",
  butter: "bg-butter",
}

/**
 * The composer (T5): words and photos (resized in the browser, re-encoded on the server), who it's
 * for, and the mode. Enter sends; Shift+Enter is a new line; while a turn runs, Send becomes Stop.
 */
export function Composer({
  people,
  personId,
  onPerson,
  mode,
  onMode,
  busy,
  onSend,
  onStop,
  onWorkflow,
}: {
  people: ChatPerson[]
  personId: string | null
  onPerson: (id: string) => void
  mode: Mode
  onMode: (mode: Mode) => void
  busy: boolean
  onSend: (text: string, photos: Uploaded[]) => void
  onStop: () => void
  onWorkflow: (slug: string) => void
}) {
  const t = useTranslations("Chat")
  const tw = useTranslations("Workflows")
  const [text, setText] = useState("")
  const [photos, setPhotos] = useState<Uploaded[]>([])
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const person = people.find((p) => p.id === personId) ?? people.find((p) => p.isSelf)

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
    onSend(words, photos)
    setText("")
    setPhotos([])
    input.current?.style.setProperty("height", "auto")
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dropping photos is a shortcut; the photo button is the accessible way
    <div
      className="flex flex-col gap-2 rounded-sheet bg-card p-2.5 text-card-foreground shadow-paper"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void add(e.dataTransfer.files)
      }}
    >
      {photos.length || uploading ? (
        <div className="flex gap-2 px-1 pt-1">
          {photos.map((p) => (
            <span key={p.id} className="relative">
              {/* biome-ignore lint/performance/noImgElement: a private, session-checked photo */}
              <img src={p.url} alt="" className="size-16 rounded-tile object-cover" />
              <button
                type="button"
                aria-label={t("removePhoto")}
                onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))}
                className="absolute -end-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-sticker text-white"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
            <span key={i} className="size-16 animate-pulse rounded-tile bg-paper-foreground/10" />
          ))}
        </div>
      ) : null}
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
          const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"))
          if (files.length) void add(files)
        }}
        placeholder={t("placeholder", { name: person?.name ?? "" })}
        aria-label={t("placeholder", { name: person?.name ?? "" })}
        className="max-h-[200px] min-h-11 resize-none bg-transparent px-2.5 py-2 text-[15px] outline-none placeholder:text-paper-muted"
      />
      {error ? <p className="px-2 text-xs text-destructive">{error}</p> : null}
      <div className="flex items-center gap-1.5">
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
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex min-w-0 items-center gap-1.5 rounded-pill px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap hover:bg-paper-foreground/8">
            <span
              className={cn("size-2.5 shrink-0 rounded-full", DOT[person?.identity ?? "violet"])}
            />
            {t("for", { name: person?.isSelf ? t("me") : (person?.name ?? "") })}
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            {people.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => onPerson(p.id)}>
                <span className={cn("size-2.5 rounded-full", DOT[p.identity])} />
                {p.isSelf ? t("me") : p.name}
                {p.id === person?.id ? <Check className="ms-auto size-4" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-pill px-2.5 py-1.5 text-sm whitespace-nowrap text-paper-muted hover:bg-paper-foreground/8">
            {t(`modesShort.${mode}`)}
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-64">
            {(["ask", "auto", "plan"] as const).map((m) => (
              <DropdownMenuItem
                key={m}
                onClick={() => onMode(m)}
                className="flex-col items-start gap-0.5"
              >
                <span className="flex w-full items-center font-semibold">
                  {t(`modes.${m}`)}
                  {m === mode ? <Check className="ms-auto size-4" /> : null}
                </span>
                <span className="text-xs text-muted-foreground">{t(`modeHints.${m}`)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-pill bg-paper-foreground/6 px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap hover:bg-paper-foreground/10">
            {tw("pill")}
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {WORKFLOW_SLUGS.map((slug) => {
              const look = WORKFLOW_LOOK[slug]
              const Icon = look?.icon
              return (
                <DropdownMenuItem
                  key={slug}
                  onClick={() => onWorkflow(slug)}
                  className="items-start gap-2.5 py-2"
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-tile text-black",
                      look?.tone,
                    )}
                  >
                    {Icon ? <Icon className="size-4" /> : null}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold">
                      {tw(`items.${slug}.name` as "items.night-in.name")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tw(`items.${slug}.desc` as "items.night-in.desc")}
                    </span>
                  </span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex-1" />
        <VoiceButton
          onText={(words) => setText((now) => (now.trim() ? `${now.trimEnd()} ${words}` : words))}
          onError={setError}
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t("stop")}
            className="grid size-10 place-items-center rounded-full bg-sticker text-white"
          >
            <Square className="size-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            aria-label={t("send")}
            disabled={(!text.trim() && !photos.length) || uploading > 0}
            className="grid size-10 place-items-center rounded-full bg-lime text-lime-foreground shadow-sticker transition-transform enabled:hover:-translate-y-px disabled:opacity-35"
          >
            <ArrowUp className="size-5" />
          </button>
        )}
      </div>
    </div>
  )
}
