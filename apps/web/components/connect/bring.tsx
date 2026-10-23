"use client"

import { YOUTUBE } from "@najimi/config"
import { candidatesFromExport, EXPORT_FILES, type ExportPlatform } from "@najimi/connectors/exports"
import { SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { useQuery } from "@tanstack/react-query"
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
import { authClient } from "@/lib/auth-client"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { type Hit, ReviewHits } from "./review-hits"
import { SocialRead } from "./social-read"

/*
 * Bring your taste in (W14): what you already follow and love elsewhere. Exports (Instagram,
 * TikTok, Spotify, YouTube) are opened here in your browser and only the short lists inside
 * (handles, artists, channel names) are sent on; an X account is read by its handle (who it shares
 * and mentions); usernames and handles are read by name. Qloo matches each to the real thing; you
 * keep what's you.
 */

export type Source =
  | { kind: "export"; id: ExportPlatform; icon: typeof siX; name: string }
  | { kind: "social"; id: "x"; icon: typeof siX; name: string }
  | {
      kind: "name"
      id: "handles" | "letterboxd" | "goodreads" | "lastfm"
      icon: typeof siX
      name: string
    }

export const SOURCES: Source[] = [
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

/** The sheet for one source: an export's steps and file, a name or handle, then the review. */
export function BringSheet({
  source,
  personId,
  connected,
  auto = false,
  onSwitch,
  onClose,
}: {
  source: Source
  personId: string
  /** Just back from connecting the account: read it straight away. */
  auto?: boolean
  /** Their own connected account here, read straight away on request. */
  connected?: { platform: "x" | "instagram"; handle: string | null } | null
  onSwitch: (s: Source) => void
  onClose: () => void
}) {
  const t = useTranslations("Connect")
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const [working, setWorking] = useState(false)
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [reading, setReading] = useState<{ handle: string | null } | null>(null)

  const found = (list: Hit[]) => {
    setHits(list)
    if (list.length) sound("promote")
  }

  const fromFile = async (file: File) => {
    if (source.kind !== "export") return
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
    if (source.kind === "social") {
      setReading({ handle: value.trim() })
      return
    }
    if (source.kind !== "name") return
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

  const mine = connected && source.id === connected.platform ? connected : null

  // YouTube connects with Google (read-only); its Takeout file stays the second way in.
  const youtube = useQuery({
    queryKey: ["youtube-import"],
    queryFn: () => api<{ available: boolean; connected: boolean }>("/api/imports/youtube"),
    enabled: source.id === "youtube",
  })
  const yt = source.id === "youtube" ? youtube.data : undefined
  const readYouTube = async () => {
    setWorking(true)
    try {
      found((await api<{ hits: Hit[] }>("/api/imports/youtube", { json: {} })).hits)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setWorking(false)
    }
  }
  const connectYouTube = async () => {
    setWorking(true)
    const session = await authClient.getSession()
    const callbackURL = `${window.location.pathname}?bring=youtube`
    const scopes = [YOUTUBE.readonly]
    // A guest signs in with Google (and keeps everything); someone signed in links it.
    const r =
      !session.data || session.data.user.isAnonymous
        ? await authClient.signIn.social({ provider: "google", scopes, callbackURL })
        : await authClient.linkSocial({ provider: "google", scopes, callbackURL })
    if (r.error) {
      setWorking(false)
      toast(r.error.message ?? t("error"))
    }
  }
  const autoRead = auto && yt?.connected && hits === null && !working
  // biome-ignore lint/correctness/useExhaustiveDependencies: reads once, when the account is ready
  useEffect(() => {
    if (autoRead) void readYouTube()
  }, [autoRead])

  return (
    <div className="flex flex-col gap-4 pt-5">
      <SheetTitle className="flex items-center gap-2 font-title text-[1.6rem] font-normal">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white">
          <BrandIcon icon={source.icon} colored className="size-5" />
        </span>{" "}
        {source.name}
      </SheetTitle>
      {reading ? (
        <SocialRead
          platform={mine?.platform ?? "x"}
          handle={reading.handle}
          personId={personId}
          onDone={onClose}
        />
      ) : hits !== null ? (
        <ReviewHits personId={personId} hits={hits} onAdded={onClose} />
      ) : (
        <>
          {mine ? (
            <button
              type="button"
              onClick={() => setReading({ handle: null })}
              className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground"
            >
              {t("readHandle", { handle: mine.handle ?? "" })}
            </button>
          ) : null}
          {yt?.available ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={working}
                onClick={() => void (yt.connected ? readYouTube() : connectYouTube())}
                className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-60"
              >
                {working ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <BrandIcon icon={siYoutube} colored className="size-5" />
                )}
                {yt.connected ? t("readYouTube") : t("connectYouTube")}
              </button>
              <p className="text-center text-[12px] text-text-3">{t("youtubeReadOnly")}</p>
              <p className="pt-2 text-[13px] font-semibold text-text-3">{t("orTakeout")}</p>
            </div>
          ) : null}
          {source.kind === "export" && !mine ? (
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
              <p className="text-center text-[12px] text-text-3">{t("privacy")}</p>
            </>
          ) : source.kind !== "export" ? (
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
                placeholder={t(
                  `placeholder.${source.kind === "social" ? "x" : source.id}` as "placeholder.handles",
                )}
                aria-label={source.name}
                autoCapitalize="none"
                className="h-12 rounded-tile bg-card px-4 text-[16px] outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={working || !value.trim()}
                className={
                  mine
                    ? "flex h-12 items-center justify-center gap-2 rounded-pill bg-card font-heading text-[15px] ring-1 ring-border disabled:opacity-40"
                    : "flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-40"
                }
              >
                {working ? <Loader2 className="size-5 animate-spin" /> : null}
                {source.kind === "social" ? t("readAnyone") : t("find")}
              </button>
              {source.kind === "social" ? (
                <button
                  type="button"
                  onClick={() => onSwitch(HANDLES)}
                  className="self-center text-[13px] text-text-3 underline underline-offset-4"
                >
                  {t("pasteHandles")}
                </button>
              ) : null}
            </form>
          ) : null}
        </>
      )}
    </div>
  )
}

const MORE = ["spotify", "letterboxd", "goodreads", "lastfm"] as const

/** Taste that lives beyond the four feeds: one small row of logos. */
export function AlsoFrom({ onOpen }: { onOpen: (s: Source) => void }) {
  const t = useTranslations("Connect")
  return (
    <section className="flex items-center gap-3">
      <span className="shrink-0 text-[13px] font-semibold text-text-3">{t("alsoFrom")}</span>
      <div className="flex flex-1 flex-wrap gap-2">
        {MORE.map((id) => {
          const s = SOURCES.find((x) => x.id === id)
          if (!s) return null
          return (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(s)}
              aria-label={s.name}
              title={s.name}
              className="flex h-10 items-center gap-2 rounded-pill bg-card ps-1.5 pe-3.5 text-[13px] font-semibold ring-1 ring-border transition-colors hover:bg-secondary"
            >
              <span className="grid size-7 place-items-center rounded-full bg-white">
                <BrandIcon icon={s.icon} colored className="size-4" />
              </span>
              <span className="hidden sm:inline">{s.name}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
