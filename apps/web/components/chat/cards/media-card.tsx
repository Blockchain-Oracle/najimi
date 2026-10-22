"use client"

import type { NajimiTools } from "@najimi/agent"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { Download, RefreshCw, Share2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { api } from "@/lib/fetcher"
import { type RunEvent, useRunEvents } from "@/lib/use-run"
import { WithPerson } from "../chat-context"
import { Making } from "../making"
import { useMediaUrl, usePublicShare } from "../public-share"
import { CompareSlider } from "./compare-slider"

type ImageOut = NajimiTools["makeImage"]["output"]

const uploadUrl = (id: string) => `/api/media/upload/${id}?v=original`

async function shareCreation(creationId: string, copied: string) {
  const { url } = await api<{ url: string }>("/api/shares", {
    json: { kind: "creation", refId: creationId },
  })
  await navigator.clipboard.writeText(url).catch(() => undefined)
  toast(copied)
}

/**
 * Images Najimi is making or made (T9, T10): they appear as each finishes (the run's events, which
 * replay after a reload). A restyle shows before and after; every variant can be downloaded,
 * shared, varied or turned into a video.
 */
export function ImageCard({ output, onAsk }: { output: ImageOut; onAsk: (text: string) => void }) {
  const t = useTranslations("Make")
  const share = usePublicShare()
  const creationUrl = useMediaUrl()
  const [ready, setReady] = useState<Set<string>>(() => new Set(share?.ready ?? []))
  const [failed, setFailed] = useState<string | null>(null)
  const [pick, setPick] = useState(0)
  const onEvent = useCallback((e: RunEvent) => {
    if (e.type === "asset") setReady((s) => new Set(s).add(e.data.creationId as string))
    if (e.type === "status" && e.data.status === "failed")
      setFailed((e.data.error as string) ?? "failed")
  }, [])
  useRunEvents(share ? null : output.runId, onEvent)

  if (!output.runId)
    return share ? null : (
      <p className="rounded-card bg-card px-4 py-3 text-sm text-card-foreground shadow-paper">
        {output.note === "allowance" ? t("noneLeft") : t("notMade")}
      </p>
    )
  const ids = share
    ? output.creationIds.filter((id) => share.ready.includes(id))
    : output.creationIds
  if (share && !ids.length) return null
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
        <h3 className="font-heading text-[17px] leading-snug">{output.title}</h3>
        <span className="text-xs text-paper-muted">
          <WithPerson text={(name) => t("forName", { name })} name={output.personName} />
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
        <Making before={before} label={t("making", { n: ids.length })} words={output.words} />
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
      {isReady && current && !share ? (
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
            onClick={() => shareCreation(current, t("linkCopied"))}
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
        </div>
      ) : null}
    </section>
  )
}
