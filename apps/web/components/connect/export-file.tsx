"use client"

import { EXPORTS } from "@najimi/config"
import { EXPORT_FILES, type ExportPlatform, exportContents } from "@najimi/connectors/exports"
import { toast } from "@najimi/ui/components/sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BellRing, ExternalLink, FileArchive, Loader2 } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { api } from "@/lib/fetcher"
import type { Hit } from "./review-hits"

/*
 * Your data, fetched by you in two taps: open the platform's own download page from here (Najimi
 * remembers you asked and reminds you when the file is usually ready), then choose the file when
 * it comes. The file is opened in this browser; only the short lists inside are sent on.
 */

type Request = { platform: ExportPlatform; requestedAt: string; readyAt: string }

/** At most this much of an archive is read (only the few files that matter). */
const MAX_READ = 40 * 1024 * 1024

async function readExport(file: File, platform: ExportPlatform): Promise<Record<string, string>> {
  const pattern = EXPORT_FILES[platform]
  const decoder = new TextDecoder()
  if (!file.name.toLowerCase().endsWith(".zip")) return { [file.name]: await file.text() }
  const { unzip } = await import("fflate")
  const bytes = new Uint8Array(await file.arrayBuffer())
  return new Promise((resolve, reject) => {
    let total = 0
    unzip(
      bytes,
      {
        filter: (f) => {
          if (!pattern.test(f.name)) return false
          total += f.originalSize
          return total <= MAX_READ
        },
      },
      (error, files) => {
        if (error) return reject(error)
        resolve(
          Object.fromEntries(
            Object.entries(files).map(([name, data]) => [name, decoder.decode(data)]),
          ),
        )
      },
    )
  })
}

export function ExportFile({
  platform,
  name,
  onHits,
}: {
  platform: ExportPlatform
  name: string
  onHits: (hits: Hit[]) => void
}) {
  const t = useTranslations("Connect")
  const format = useFormatter()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [working, setWorking] = useState(false)
  const requests = useQuery({
    queryKey: ["export-requests"],
    queryFn: () => api<{ requests: Request[] }>("/api/imports/requests"),
  })
  const asked = requests.data?.requests.find((r) => r.platform === platform) ?? null

  const ask = () => {
    // Opened first, inside the tap, so the browser doesn't block it.
    window.open(EXPORTS.request[platform], "_blank", "noopener")
    void api("/api/imports/requests", { json: { platform } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["export-requests"] }))
      .catch(() => undefined)
  }

  const fromFile = async (file: File) => {
    setWorking(true)
    try {
      const contents = exportContents(platform, await readExport(file, platform))
      if (!contents.candidates.length && !contents.texts.length)
        throw new Error(t("nothingInExport"))
      const r = await api<{ hits: Hit[] }>("/api/imports/export", {
        json: { platform, candidates: contents.candidates, texts: contents.texts },
      })
      void queryClient.invalidateQueries({ queryKey: ["export-requests"] })
      onHits(r.hits)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setWorking(false)
    }
  }

  const now = new Date()
  const ready = asked ? new Date(asked.readyAt) : null

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        <li className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-bold">
            1
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <button
              type="button"
              onClick={ask}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-card text-[14px] font-semibold ring-1 ring-border transition-colors hover:bg-secondary"
            >
              <ExternalLink className="size-4" /> {t("askFor", { name })}
            </button>
            <p className="text-[13px] leading-snug text-text-3">{t(`choose.${platform}`)}</p>
            {asked && ready ? (
              <p className="flex items-start gap-2 text-[13px] leading-snug text-text-2">
                <BellRing className="mt-0.5 size-3.5 shrink-0" />
                {ready > now
                  ? t("asked", {
                      when: format.relativeTime(new Date(asked.requestedAt), now),
                      ready: format.relativeTime(ready, now),
                    })
                  : t("readyNow", { when: format.relativeTime(new Date(asked.requestedAt), now) })}
              </p>
            ) : null}
          </div>
        </li>
        <li className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-bold">
            2
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              ref={input}
              type="file"
              accept=".zip,.json,.csv,.js"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void fromFile(f)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              disabled={working}
              onClick={() => input.current?.click()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-60"
            >
              {working ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <FileArchive className="size-5" />
              )}
              {working ? t("reading") : t("pickExport")}
            </button>
            <p className="text-[13px] leading-snug text-text-3">{t(`reads.${platform}`)}</p>
          </div>
        </li>
      </ol>
      <p className="text-center text-[12px] text-text-3">{t("privacy")}</p>
    </div>
  )
}
