"use client"

import { candidatesFromExport, EXPORT_FILES, type ExportPlatform } from "@najimi/connectors/exports"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { Check, FileArchive, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
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

/*
 * Bring your taste in (W14): what you already follow and love elsewhere. Exports (Instagram,
 * TikTok, Spotify, YouTube) are opened here in your browser and only the short lists inside
 * (handles, artists, channel names) are sent on; usernames and handles are read by name. Qloo
 * matches each to the real thing; you keep what's you. After SeatGeek's connect step (Refero
 * 9cca4ae4) and BeReal's "connected" toast (76a2af67).
 */

type Hit = {
  qlooId: string
  type: string
  name: string
  image: string | null
  caption: string | null
  from: string
}
type Source =
  | { kind: "export"; id: ExportPlatform; icon: typeof siX; name: string }
  | {
      kind: "name"
      id: "handles" | "letterboxd" | "goodreads" | "lastfm"
      icon: typeof siX
      name: string
    }

const SOURCES: Source[] = [
  { kind: "export", id: "instagram", icon: siInstagram, name: "Instagram" },
  { kind: "export", id: "tiktok", icon: siTiktok, name: "TikTok" },
  { kind: "export", id: "spotify", icon: siSpotify, name: "Spotify" },
  { kind: "export", id: "youtube", icon: siYoutube, name: "YouTube" },
  { kind: "name", id: "handles", icon: siX, name: "X handles" },
  { kind: "name", id: "letterboxd", icon: siLetterboxd, name: "Letterboxd" },
  { kind: "name", id: "goodreads", icon: siGoodreads, name: "Goodreads" },
  { kind: "name", id: "lastfm", icon: siLastdotfm, name: "Last.fm" },
]

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
  const router = useRouter()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [value, setValue] = useState("")
  const [working, setWorking] = useState(false)
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [kept, setKept] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  const open = (s: Source) => {
    sound("tap")
    setSource(s)
    setHits(null)
    setValue("")
  }
  const found = (list: Hit[]) => {
    setHits(list)
    setKept(new Set(list.map((h) => h.qlooId)))
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
    if (source?.kind !== "name" || !value.trim()) return
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

  const add = async () => {
    const chosen = (hits ?? []).filter((h) => kept.has(h.qlooId))
    if (!chosen.length) return
    setAdding(true)
    try {
      const r = await api<{ added: number }>(`/api/people/${personId}/loves/batch`, {
        json: {
          loves: chosen.map((h) => ({
            qlooId: h.qlooId,
            type: h.type,
            name: h.name,
            image: h.image,
            weight: 6,
          })),
        },
      })
      toast(t("added", { count: r.added }))
      sound("check")
      setSource(null)
      void queryClient.invalidateQueries({ queryKey: ["tuneup"] })
      router.refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setAdding(false)
    }
  }

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
                {s.kind === "export" ? t("export") : t("byName")}
              </span>
            </span>
          </button>
        ))}
      </div>

      <Sheet open={Boolean(source)} onOpenChange={(o) => !o && setSource(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[88svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          {source ? (
            <div className="flex flex-col gap-4 pt-5">
              <SheetTitle className="flex items-center gap-2 font-title text-[1.6rem] font-normal">
                <BrandIcon icon={source.icon} colored className="size-6" /> {source.name}
              </SheetTitle>
              {hits === null ? (
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
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={t(`placeholder.${source.id}` as "placeholder.handles")}
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
                  </form>
                )
              ) : hits.length ? (
                <>
                  <p className="text-[14px] text-text-2">
                    {t("foundSome", { count: hits.length })}
                  </p>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {hits.map((h) => {
                      const on = kept.has(h.qlooId)
                      return (
                        <li key={h.qlooId}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setKept((s) => {
                                const next = new Set(s)
                                if (on) next.delete(h.qlooId)
                                else next.add(h.qlooId)
                                return next
                              })
                            }
                            className={cn(
                              "relative flex w-full flex-col overflow-hidden rounded-tile bg-card text-start ring-2 transition-[box-shadow,opacity]",
                              on ? "ring-signal" : "opacity-50 ring-transparent",
                            )}
                          >
                            {h.image ? (
                              // biome-ignore lint/performance/noImgElement: remote artwork
                              <img
                                src={h.image}
                                alt=""
                                className="aspect-square w-full object-cover"
                              />
                            ) : (
                              <span className="aspect-square w-full bg-secondary" />
                            )}
                            <span className="truncate px-2 py-1.5 text-[12px] font-semibold">
                              {h.name}
                            </span>
                            {on ? (
                              <span className="absolute top-1.5 end-1.5 grid size-5 place-items-center rounded-full bg-signal text-signal-foreground">
                                <Check className="size-3" strokeWidth={3} />
                              </span>
                            ) : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <button
                    type="button"
                    disabled={adding || !kept.size}
                    onClick={() => void add()}
                    className="sticky bottom-0 flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-40"
                  >
                    {adding ? <Loader2 className="size-5 animate-spin" /> : null}
                    {t("addKept", { count: kept.size })}
                  </button>
                </>
              ) : (
                <p className="text-[14px] text-text-3">{t("noneFound")}</p>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}
