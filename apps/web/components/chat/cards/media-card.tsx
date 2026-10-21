"use client"

import type { NajimiTools } from "@najimi/agent"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { Clapperboard, Download, RefreshCw, Share2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { api } from "@/lib/fetcher"
import { type RunEvent, useRunEvents } from "@/lib/use-run"
import { CompareSlider } from "./compare-slider"

type ImageOut = NajimiTools["makeImage"]["output"]
type VideoOut = NajimiTools["makeVideo"]["output"]

export const creationUrl = (id: string, v: "original" | "display" | "thumb" = "display") =>
  `/api/media/creation/${id}?v=${v}`
const uploadUrl = (id: string) => `/api/media/upload/${id}?v=original`

async function share(creationId: string, copied: string) {
  const { url } = await api<{ url: string }>("/api/shares", {
    json: { kind: "creation", refId: creationId },
  })
  await navigator.clipboard.writeText(url).catch(() => undefined)
  toast(copied)
}

function Progress({ label }: { label: string }) {
  return (
    <div className="relative grid aspect-[3/2] place-items-center overflow-hidden rounded-tile bg-ash">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-lime/10 via-transparent to-violet/15" />
      <span className="relative flex items-center gap-2 text-sm text-white/80">
        <span className="size-2 animate-lime-pulse rounded-full bg-lime" /> {label}
      </span>
    </div>
  )
}

/**
 * Images Najimi is making or made (T9, T10): they appear as each finishes (the run's events, which
 * replay after a reload). A restyle shows before and after; every variant can be downloaded,
 * shared, varied or turned into a video.
 */
export function ImageCard({ output, onAsk }: { output: ImageOut; onAsk: (text: string) => void }) {
  const t = useTranslations("Make")
  const [ready, setReady] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<string | null>(null)
  const [pick, setPick] = useState(0)
  const onEvent = useCallback((e: RunEvent) => {
    if (e.type === "asset") setReady((s) => new Set(s).add(e.data.creationId as string))
    if (e.type === "status" && e.data.status === "failed")
      setFailed((e.data.error as string) ?? "failed")
  }, [])
  useRunEvents(output.runId, onEvent)

  if (!output.runId)
    return (
      <p className="rounded-card bg-card px-4 py-3 text-sm text-card-foreground shadow-paper">
        {output.note === "allowance" ? t("noneLeft") : t("notMade")}
      </p>
    )
  const ids = output.creationIds
  const current = ids[pick] ?? ids[0]
  const before = output.sourceUploadId
    ? uploadUrl(output.sourceUploadId)
    : output.sourceCreationId
      ? creationUrl(output.sourceCreationId)
      : null
  const isReady = Boolean(current && ready.has(current))

  return (
    <section className="flex animate-card-land flex-col gap-3 rounded-card bg-card p-3 text-card-foreground shadow-paper">
      <header className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="font-title text-lg leading-tight">{output.title}</h3>
        <span className="text-xs text-paper-muted">
          {t("forName", { name: output.personName })}
        </span>
      </header>
      {failed ? (
        <div className="flex flex-col items-start gap-2 rounded-tile bg-ash p-4 text-sm text-white">
          <p>{failed === "refused" ? t("refused") : t("failed")}</p>
          <button
            type="button"
            onClick={() => onAsk(t("retryAsk", { title: output.title }))}
            className="sticker inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold"
          >
            <RefreshCw className="size-3.5" /> {t("retry")}
          </button>
        </div>
      ) : isReady && current ? (
        before ? (
          <CompareSlider
            before={before}
            after={creationUrl(current)}
            beforeLabel={t("before")}
            afterLabel={t("after")}
          />
        ) : (
          // biome-ignore lint/performance/noImgElement: private, session-checked media
          <img src={creationUrl(current)} alt={output.title} className="w-full rounded-tile" />
        )
      ) : (
        <Progress label={t("making", { n: ids.length })} />
      )}
      {ids.length > 1 ? (
        <div className="flex gap-2 px-1">
          {ids.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => setPick(i)}
              aria-label={t("variant", { n: i + 1 })}
              className={cn(
                "size-14 overflow-hidden rounded-sm ring-2 transition",
                i === pick ? "ring-lime-ink" : "ring-transparent opacity-70",
              )}
            >
              {ready.has(id) ? (
                // biome-ignore lint/performance/noImgElement: private, session-checked media
                <img src={creationUrl(id, "thumb")} alt="" className="size-full object-cover" />
              ) : (
                <span className="block size-full animate-pulse bg-paper-foreground/10" />
              )}
            </button>
          ))}
        </div>
      ) : null}
      {output.words.length ? (
        <ul className="flex flex-wrap gap-1 px-1">
          {output.words.map((w) => (
            <li key={w} className="rounded-pill bg-paper-foreground/6 px-2 py-0.5 text-[11px]">
              {w}
            </li>
          ))}
        </ul>
      ) : null}
      {isReady && current ? (
        <div className="flex flex-wrap gap-1.5 px-1 pb-1">
          <a
            href={creationUrl(current, "original")}
            download
            className="inline-flex items-center gap-1.5 rounded-pill bg-paper-foreground/6 px-3 py-1.5 text-xs font-semibold"
          >
            <Download className="size-3.5" /> {t("download")}
          </a>
          <button
            type="button"
            onClick={() => share(current, t("linkCopied"))}
            className="inline-flex items-center gap-1.5 rounded-pill bg-paper-foreground/6 px-3 py-1.5 text-xs font-semibold"
          >
            <Share2 className="size-3.5" /> {t("share")}
          </button>
          <button
            type="button"
            onClick={() => onAsk(t("variationAsk", { title: output.title }))}
            className="inline-flex items-center gap-1.5 rounded-pill bg-paper-foreground/6 px-3 py-1.5 text-xs font-semibold"
          >
            <Sparkles className="size-3.5" /> {t("variation")}
          </button>
          <button
            type="button"
            onClick={() => onAsk(t("videoAsk", { title: output.title, n: pick + 1 }))}
            className="inline-flex items-center gap-1.5 rounded-pill bg-lime px-3 py-1.5 text-xs font-semibold text-lime-foreground"
          >
            <Clapperboard className="size-3.5" /> {t("makeVideo")}
          </button>
        </div>
      ) : null}
    </section>
  )
}

/** A video rendering at the provider (T11): honest progress, then the player. */
export function VideoCard({ output }: { output: VideoOut }) {
  const t = useTranslations("Make")
  const [stage, setStage] = useState<{ stage: string; position?: number | null }>({
    stage: "queued",
  })
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const onEvent = useCallback((e: RunEvent) => {
    if (e.type === "progress") setStage(e.data as { stage: string; position?: number | null })
    if (e.type === "asset") setDone(true)
    if (e.type === "status" && e.data.status === "failed")
      setFailed((e.data.error as string) ?? "failed")
  }, [])
  useRunEvents(output.runId, onEvent)
  if (!output.runId || !output.creationId)
    return (
      <p className="rounded-card bg-card px-4 py-3 text-sm text-card-foreground shadow-paper">
        {output.note === "unavailable"
          ? t("videoSoon")
          : output.note === "allowance"
            ? t("noneLeftVideo")
            : t("notMade")}
      </p>
    )
  const poster = output.posterCreationId ? creationUrl(output.posterCreationId) : undefined
  return (
    <section className="flex animate-card-land flex-col gap-3 rounded-card bg-card p-3 text-card-foreground shadow-paper">
      <h3 className="font-title px-1 text-lg leading-tight">{output.title}</h3>
      {failed ? (
        <p className="rounded-tile bg-ash p-4 text-sm text-white">
          {failed === "refused" ? t("refused") : t("failed")}
        </p>
      ) : done ? (
        // biome-ignore lint/a11y/useMediaCaption: generated video with no speech
        <video
          src={creationUrl(output.creationId, "original")}
          poster={poster}
          controls
          playsInline
          preload="none"
          className="w-full rounded-tile bg-black"
        />
      ) : (
        <div className="relative overflow-hidden rounded-tile">
          {poster ? (
            // biome-ignore lint/performance/noImgElement: private, session-checked media
            <img src={poster} alt="" className="w-full opacity-50 blur-[1px]" />
          ) : (
            <div className="aspect-video bg-ash" />
          )}
          <span className="absolute inset-0 grid place-items-center">
            <span className="sticker flex items-center gap-2 px-3 py-1.5 text-sm font-semibold">
              <span className="size-2 animate-lime-pulse rounded-full bg-lime" />
              {stage.stage === "running"
                ? t("rendering")
                : stage.position != null
                  ? t("queuedAt", { n: stage.position + 1 })
                  : t("queued")}
            </span>
          </span>
        </div>
      )}
    </section>
  )
}
