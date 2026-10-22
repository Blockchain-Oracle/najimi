"use client"

import { candidatesFromExport, EXPORT_FILES, type ExportPlatform } from "@najimi/connectors/exports"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { FileArchive, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import {
  siGoodreads,
  siInstagram,
  siLastdotfm,
  siLetterboxd,
  siSpotify,
  siTiktok,
  siX,
  siYoutube,
} from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { type Hit, ReviewHits } from "./review-hits"
import { SocialRead } from "./social-read"

/*
 * Bring your taste in (W14): what you already follow and love elsewhere. Exports (Instagram,
 * TikTok, Spotify, YouTube) are opened here in your browser and only the short lists inside
 * (handles, artists, channel names) are sent on; an X account is read by its handle (who it
 * shares and mentions); usernames and handles are read by name. Qloo matches each to the real
 * thing; you keep what's you. After SeatGeek's connect step (Refero 9cca4ae4) and BeReal's
 * "connected" toast (76a2af67).
 */

/** Other parts of the page open a source here (the accounts list's "Bring export"). */
export const BRING_EVENT = "najimi:bring"

type Source =
  | { kind: "export"; id: ExportPlatform; icon: typeof siX; name: string }
  | { kind: "social"; id: "x"; icon: typeof siX; name: string }
  | {
      kind: "name"
      id: "handles" | "letterboxd" | "goodreads" | "lastfm"
      icon: typeof siX
      name: string
    }

const SOURCES: Source[] = [
  { kind: "social", id: "x", icon: siX, name: "X" },
  { kind: "export", id: "instagram", icon: siInstagram, name: "Instagram" },
  { kind: "export", id: "tiktok", icon: siTiktok, name: "TikTok" },
  { kind: "export", id: "youtube", icon: siYoutube, name: "YouTube" },
  { kind: "export", id: "spotify", icon: siSpotify, name: "Spotify" },
  { kind: "name", id: "letterboxd", icon: siLetterboxd, name: "Letterboxd" },
  { kind: "name", id: "goodreads", icon: siGoodreads, name: "Goodreads" },
  { kind: "name", id: "lastfm", icon: siLastdotfm, name: "Last.fm" },
]
/** Pasted handles and links (X or Instagram), reached from the X sheet. */
const HANDLES: Source = { kind: "name", id: "handles", icon: siX, name: "Handles" }

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

export function BringTaste({ personId }: { personId: string }) {
  const t = useTranslations("Connect")
  const input = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [value, setValue] = useState("")
  const [working, setWorking] = useState(false)
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [reading, setReading] = useState<string | null>(null)

  const open = (s: Source) => {
    sound("tap")
    setSource(s)
    setHits(null)
    setReading(null)
    setValue("")
  }
  // The accounts list asks for an export by id.
  useEffect(() => {
    const onBring = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      const found = SOURCES.find((s) => s.id === id)
      if (found) open(found)
    }
    window.addEventListener(BRING_EVENT, onBring)
    return () => window.removeEventListener(BRING_EVENT, onBring)
  })
  const found = (list: Hit[]) => {
    setHits(list)
    if (list.length) sound("promote")
  }

  const fromFile = async (file: File) => {
    if (source?.kind !== "export") return
    setWorking(true)
    try {
      const files = await readExport(file, source.id)
      const candidates = candidatesFromExport(source.id, files)
      if (!candidates.length) throw new Error(t("nothingInExport"))
      const r = await api<{ hits: Hit[] }>("/api/imports/export", {
        json: { platform: source.id, candidates },
      })
      found(r.hits)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setWorking(false)
    }
  }

  const fromName = async () => {
    if (!value.trim()) return
    if (source?.kind === "social") {
      setReading(value.trim())
      return
    }
    if (source?.kind !== "name") return
    setWorking(true)
    try {
      const r = await api<{ hits: Hit[] }>("/api/imports", {
        json: { source: source.id, value: value.trim() },
      })
      found(r.hits)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setWorking(false)
    }
  }

  const close = () => setSource(null)

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 className="font-heading text-[17px]">{t("bringTitle")}</h2>
        <span className="text-[13px] text-text-3">{t("bringLine")}</span>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => open(s)}
            className="flex items-center gap-2.5 rounded-tile bg-card p-3 text-start ring-1 ring-border transition-colors hover:bg-secondary"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white">
              <BrandIcon icon={s.icon} colored className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-semibold">{s.name}</span>
              <span className="truncate text-[11px] text-text-3">
                {s.kind === "export"
                  ? t("export")
                  : s.kind === "social"
                    ? t("byHandle")
                    : t("byName")}
              </span>
            </span>
          </button>
        ))}
      </div>

      <Sheet open={Boolean(source)} onOpenChange={(o) => !o && close()}>
        <SheetContent
          side="bottom"
          className="max-h-[88svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          {source ? (
            <div className="flex flex-col gap-4 pt-5">
              <SheetTitle className="flex items-center gap-2 font-title text-[1.6rem] font-normal">
                <BrandIcon icon={source.icon} colored className="size-6" /> {source.name}
              </SheetTitle>
              {reading && source.kind === "social" ? (
                <SocialRead platform="x" handle={reading} personId={personId} onDone={close} />
              ) : hits === null ? (
                source.kind === "export" ? (
                  <>
                    <ol className="flex flex-col gap-2 text-[14px] text-text-2">
                      {[1, 2, 3].map((n) => (
                        <li key={n} className="flex gap-3">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-bold">
                            {n}
                          </span>
                          {t(`how.${source.id}.${n}` as "how.instagram.1")}
                        </li>
                      ))}
                    </ol>
                    <p className="text-[12px] text-text-3">{t("privacy")}</p>
                    <input
                      ref={input}
                      type="file"
                      accept=".zip,.json,.csv"
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
                      className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-60"
                    >
                      {working ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <FileArchive className="size-5" />
                      )}
                      {working ? t("reading") : t("pickExport")}
                    </button>
                  </>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      void fromName()
                    }}
                    className="flex flex-col gap-3"
                  >
                    {source.kind === "social" ? (
                      <p className="text-[14px] text-text-2">{t("xHandleLine")}</p>
                    ) : null}
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={t(
                        `placeholder.${source.kind === "social" ? "x" : source.id}` as "placeholder.handles",
                      )}
                      autoCapitalize="none"
                      className="h-12 rounded-tile bg-card px-4 text-[16px] outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="submit"
                      disabled={working || !value.trim()}
                      className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-40"
                    >
                      {working ? <Loader2 className="size-5 animate-spin" /> : null}
                      {t("find")}
                    </button>
                    {source.kind === "social" ? (
                      <button
                        type="button"
                        onClick={() => open(HANDLES)}
                        className="self-center text-[13px] text-text-3 underline underline-offset-4"
                      >
                        {t("pasteHandles")}
                      </button>
                    ) : null}
                  </form>
                )
              ) : (
                <ReviewHits personId={personId} hits={hits} onAdded={close} />
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}
