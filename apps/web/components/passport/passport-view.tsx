"use client"

import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import {
  BedDouble,
  CirclePlus,
  Download,
  Gamepad2,
  Heart,
  Link2,
  Loader2,
  Moon,
  Plane,
  Ticket,
  UtensilsCrossed,
} from "lucide-react"
import Link from "next/link"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { siInstagram } from "simple-icons"
import { useReportScreen } from "@/components/agent/agent-context"
import { BrandIcon } from "@/components/brands/brand-icon"
import { sized } from "@/components/connect/platforms"
import { OpenThing } from "@/components/entity/entity-provider"
import { DarkSheet } from "@/components/feed/dark-sheet"
import { api } from "@/lib/fetcher"
import type { Stamp, StampKind, Upcoming } from "@/lib/passport"
import { sound } from "@/lib/sounds"

/*
 * The Taste Passport (W21) and its Wrapped (W22). The year at a glance (one number on its art,
 * three rings); what's coming up; the Wrapped slides, each with its own share step; how the taste
 * moved month by month; then every stamp, inked where it fell (only what happened).
 */

const ICON: Record<StampKind, typeof Heart> = {
  love: Heart,
  night: Moon,
  trip: Plane,
  stay: BedDouble,
  table: UtensilsCrossed,
  show: Ticket,
  game: Gamepad2,
}
const SLIDES = [1, 2, 3, 4, 5]
const KINDS = ["artist", "movie", "tv_show", "book", "podcast", "place", "brand", "videogame"]

/** A stamp's tilt, the same every time for the same stamp. */
const tilt = (id: string) => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 17) - 8
}

function Wrapped({ token: initial, personId }: { token: string | null; personId: string }) {
  const t = useTranslations("Passport")
  const [token, setToken] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [sharing, setSharing] = useState<number | null>(null)

  const make = async () => {
    setBusy(true)
    try {
      const r = await api<{ token: string }>("/api/shares", {
        json: { kind: "wrapped", refId: personId },
      })
      setToken(r.token)
      sound("promote")
    } catch (e) {
      toast(e instanceof Error ? e.message : t("failed"))
    } finally {
      setBusy(false)
    }
  }
  if (!token)
    return (
      <section className="dark relative isolate flex flex-col gap-4 overflow-hidden rounded-sheet bg-[#0b0b0d] p-6 text-foreground ring-1 ring-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full opacity-35 blur-3xl"
          style={{ background: "radial-gradient(circle, #8B5CFF 0%, transparent 70%)" }}
        />
        <h2 className="font-title text-[1.8rem] leading-tight">{t("wrappedTitle")}</h2>
        <p className="text-[15px] text-text-2">{t("wrappedLine")}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void make()}
          className="flex h-12 items-center justify-center gap-2 self-start rounded-pill bg-foreground px-5 font-heading text-[15px] text-background"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : null} {t("make")}
        </button>
      </section>
    )
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-[18px]">{t("wrappedTitle")}</h2>
        <span className="text-[13px] text-text-3">{t("tapToShare")}</span>
      </div>
      <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
        {SLIDES.map((n) => (
          <li key={n} className="w-[42%] max-w-52 shrink-0 snap-center sm:w-48">
            <button
              type="button"
              onClick={() => setSharing(n)}
              aria-label={t("shareSlide", { n })}
              className="block w-full rounded-card transition-transform active:scale-[0.98]"
            >
              {/* biome-ignore lint/performance/noImgElement: our own generated story slide */}
              <img
                src={`/api/og/wrapped/${token}/${n}`}
                alt={t("slide", { n })}
                loading={n > 2 ? "lazy" : "eager"}
                className="aspect-[9/16] w-full rounded-card object-cover ring-1 ring-white/10"
              />
            </button>
          </li>
        ))}
      </ul>
      <ShareSlide token={token} slide={sharing} onClose={() => setSharing(null)} />
    </section>
  )
}

/**
 * One Wrapped slide, shared (after Binge's share step, Refero 4504892f): the slide large, then
 * where it goes: Instagram Stories through the phone's own share sheet, your Najimi story, saved
 * to the phone, or its link. A sheet over everything, never under the tab bar.
 */
function ShareSlide({
  token,
  slide,
  onClose,
}: {
  token: string
  slide: number | null
  onClose: () => void
}) {
  const t = useTranslations("Passport")
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<null | "share" | "story" | "save">(null)
  const src = slide ? `/api/og/wrapped/${token}/${slide}` : ""
  const name = `najimi-wrapped-${slide}.png`
  const fileOf = async () => {
    const blob = await fetch(src).then((r) => r.blob())
    return new File([blob], name, { type: "image/png" })
  }
  const save = async (file?: File) => {
    const f = file ?? (await fileOf())
    const a = document.createElement("a")
    a.href = URL.createObjectURL(f)
    a.download = f.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  const run = async (what: "share" | "story" | "save", fn: () => Promise<void>) => {
    setBusy(what)
    try {
      await fn()
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast(t("failed"))
    } finally {
      setBusy(null)
    }
  }
  const button =
    "flex h-12 w-full items-center gap-3 rounded-pill px-5 text-[15px] font-semibold transition-colors disabled:opacity-60"
  return (
    <DarkSheet
      open={slide !== null}
      onOpenChange={(o) => (o ? null : onClose())}
      title={t("shareTitle")}
    >
      {slide ? (
        <div className="flex flex-col items-center gap-5">
          {/* biome-ignore lint/performance/noImgElement: our own generated story slide */}
          <img
            src={src}
            alt={t("slide", { n: slide })}
            className="aspect-[9/16] h-[46svh] max-h-[460px] rounded-card object-cover shadow-float ring-1 ring-white/10"
          />
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void run("share", async () => {
                  const file = await fileOf()
                  // Instagram (and every app that takes a picture) sits in the phone's share sheet.
                  if (navigator.canShare?.({ files: [file] }))
                    await navigator.share({ files: [file] })
                  else {
                    await save(file)
                    toast(t("savedForInstagram"))
                  }
                })
              }
              className={cn(button, "bg-white text-black hover:bg-white/90")}
            >
              {busy === "share" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <BrandIcon icon={siInstagram} className="size-5" />
              )}
              {t("toInstagram")}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void run("story", async () => {
                  await api("/api/stories", {
                    json: { kind: "wrapped", wrappedToken: token, slide },
                  })
                  await queryClient.invalidateQueries({ queryKey: ["stories"] })
                  toast(t("onYourStory"))
                })
              }
              className={cn(button, "bg-white/[0.08] text-white hover:bg-white/[0.14]")}
            >
              {busy === "story" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <CirclePlus className="size-5" />
              )}
              {t("toNajimiStory")}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("save", () => save())}
                className={cn(
                  button,
                  "justify-center bg-white/[0.08] text-white hover:bg-white/[0.14]",
                )}
              >
                {busy === "save" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Download className="size-5" />
                )}
                {t("save")}
              </button>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(`${window.location.origin}/wrapped/${token}?s=${slide}`)
                    .then(() => toast(t("copied")))
                    .catch(() => undefined)
                }
                className={cn(
                  button,
                  "justify-center bg-white/[0.08] text-white hover:bg-white/[0.14]",
                )}
              >
                <Link2 className="size-5" /> {t("copyLink")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DarkSheet>
  )
}

/** A count in a ring that fills against the biggest of the three (after Airbuds' trio, 1904948a). */
function Ring({ value, of, label }: { value: number; of: number; label: string }) {
  const r = 26
  const length = 2 * Math.PI * r
  const share = of ? value / of : 0
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="relative grid size-16 place-items-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="5"
          />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="url(#ring)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - share)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
          <defs>
            <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-aura-1)" />
              <stop offset="100%" stopColor="var(--color-aura-2)" />
            </linearGradient>
          </defs>
        </svg>
        <span className="font-title text-[20px] tabular-nums">{value}</span>
      </span>
      <span className="text-[12px] font-semibold text-white/65">{label}</span>
    </div>
  )
}

/**
 * The year at a glance: one big number (new loves) on a collage of the year's artwork, what the
 * year leaned into, and three rings (nights out, trips, games). Years switch above it.
 */
function Hero({
  year,
  years,
  stamps,
  movement,
  count,
}: {
  year: number
  years: number[]
  stamps: Stamp[]
  movement: Record<string, number>[]
  count: (kinds: StampKind[]) => number
}) {
  const t = useTranslations("Passport")
  const nights = count(["night", "table", "show"])
  const trips = count(["trip", "stay"])
  const games = count(["game"])
  const top = Math.max(1, nights, trips, games)
  const totals = new Map<string, number>()
  for (const m of movement)
    for (const [k, n] of Object.entries(m)) totals.set(k, (totals.get(k) ?? 0) + n)
  const leaned = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const art = [...new Set(stamps.flatMap((s) => (s.image ? [s.image] : [])))].slice(-7)
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-title text-[2rem] leading-none">{t("title")}</h1>
        {years.length > 1 ? (
          <nav
            aria-label={t("years")}
            className="flex gap-1 overflow-x-auto rounded-pill bg-card p-1 ring-1 ring-border"
          >
            {years.map((y) => (
              <Link
                key={y}
                href={`/passport?year=${y}`}
                aria-current={y === year ? "page" : undefined}
                className={cn(
                  "rounded-pill px-3 py-1 text-[13px] font-semibold tabular-nums transition-colors",
                  y === year
                    ? "bg-foreground text-background"
                    : "text-text-2 hover:text-foreground",
                )}
              >
                {y}
              </Link>
            ))}
          </nav>
        ) : (
          <span className="font-title text-[2rem] leading-none text-text-3">{year}</span>
        )}
      </div>
      <section className="dark relative isolate flex min-h-64 flex-col justify-between gap-6 overflow-hidden rounded-sheet bg-[#0b0b0d] p-6 text-white ring-1 ring-white/10">
        {/* The year's artwork, fanned on the right and fading into the dark. */}
        <div
          aria-hidden
          className="absolute end-0 top-0 -z-10 h-[62%] w-[62%] [mask-image:linear-gradient(to_left,black_45%,transparent),linear-gradient(to_bottom,black_70%,transparent)] [mask-composite:intersect]"
        >
          {art.map((src, i) => (
            // biome-ignore lint/performance/noImgElement: remote artwork in the collage
            <img
              key={src}
              src={sized(src, 240) ?? src}
              alt=""
              className="absolute size-24 rounded-[14px] object-cover shadow-[0_20px_40px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10 sm:size-28"
              style={{
                top: `${4 + ((i * 29) % 44)}%`,
                right: `${4 + ((i * 23) % 56)}%`,
                transform: `rotate(${tilt(src) * 1.3}deg)`,
              }}
            />
          ))}
          <span className="absolute inset-0 bg-[radial-gradient(60%_80%_at_70%_40%,color-mix(in_oklab,var(--color-aura-1)_35%,transparent),transparent_70%)]" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-title text-[64px] leading-none tabular-nums">
            {count(["love"])}
          </span>
          <span className="text-[15px] font-semibold">{t("lovesIn", { year })}</span>
          {leaned ? (
            <span className="text-[14px] text-white/65">
              {t("leaned", { kind: t(`kind.${leaned}` as "kind.artist") })}
            </span>
          ) : null}
        </div>
        <div className="relative z-10 flex gap-6">
          <Ring value={nights} of={top} label={t("nights")} />
          <Ring value={trips} of={top} label={t("trips")} />
          <Ring value={games} of={top} label={t("games")} />
        </div>
      </section>
    </header>
  )
}

export function PassportView({
  year,
  years,
  stamps,
  movement,
  wrappedToken,
  personId,
  upcoming,
}: {
  year: number
  /** Every year they've had an account, newest first. */
  years: number[]
  stamps: Stamp[]
  /** Plans and bookings still to come. */
  upcoming: Upcoming[]
  movement: Record<string, number>[]
  wrappedToken: string | null
  personId: string
}) {
  const t = useTranslations("Passport")
  const format = useFormatter()
  useReportScreen({
    where: "passport",
    label: `their Passport for ${year}: ${stamps.length} stamps${upcoming.length ? `, ${upcoming.length} coming up (${upcoming.map((u) => u.title).join(", ")})` : ""}`,
  })
  const count = (kinds: StampKind[]) => stamps.filter((s) => kinds.includes(s.kind)).length
  const months = new Map<number, Stamp[]>()
  for (const s of stamps) {
    const m = new Date(s.at).getUTCMonth()
    months.set(m, [...(months.get(m) ?? []), s])
  }
  const peak = Math.max(1, ...movement.map((m) => Object.values(m).reduce((a, b) => a + b, 0)))
  const present = KINDS.filter((k) => movement.some((m) => m[k]))

  return (
    <div className="flex flex-col gap-8">
      <Hero year={year} years={years} stamps={stamps} movement={movement} count={count} />

      {upcoming.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-[17px]">{t("comingUp")}</h2>
          <ul className="flex flex-col gap-2">
            {upcoming.map((u) => {
              const body = (
                <>
                  {u.image ? (
                    // biome-ignore lint/performance/noImgElement: remote artwork
                    <img
                      src={u.image}
                      alt=""
                      className="size-12 shrink-0 rounded-tile object-cover"
                    />
                  ) : (
                    <span className="size-12 shrink-0 rounded-tile bg-white/5" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-heading text-[15px]">{u.title}</span>
                    <span className="text-[12px] text-text-3">
                      {t(`kinds.${u.kind}`)} ·{" "}
                      {format.dateTime(new Date(u.at), {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  {u.href ? (
                    <span className="text-[13px] font-semibold text-text-2">{t("open")} →</span>
                  ) : null}
                </>
              )
              return (
                <li key={u.id}>
                  {u.href ? (
                    <Link
                      href={u.href}
                      className="flex items-center gap-3 rounded-card bg-card p-2.5 ring-1 ring-border transition-colors hover:bg-secondary"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-card bg-card p-2.5 ring-1 ring-border">
                      {body}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <Wrapped token={wrappedToken} personId={personId} />

      {present.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-[18px]">{t("moved")}</h2>
          <div className="flex h-28 items-end gap-1.5">
            {movement.map((m, i) => {
              const total = Object.values(m).reduce((a, b) => a + b, 0)
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: months are fixed positions
                  key={i}
                  className="flex flex-1 flex-col-reverse overflow-hidden rounded-t-md bg-white/4"
                  style={{ height: `${Math.max(4, (total / peak) * 100)}%` }}
                  title={format.dateTime(new Date(Date.UTC(year, i, 1)), { month: "long" })}
                >
                  {present.map((k, j) =>
                    m[k] ? (
                      <span
                        key={k}
                        className="w-full bg-signal"
                        style={{ height: `${(m[k] / total) * 100}%`, opacity: 1 - j * 0.11 }}
                      />
                    ) : null,
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-[10px] font-semibold text-text-3 uppercase">
            {movement.map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: months are fixed positions
              <span key={i} className="flex-1 text-center">
                {format.dateTime(new Date(Date.UTC(year, i, 1)), { month: "narrow" })}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {present.map((k, j) => (
              <span key={k} className="flex items-center gap-1.5 text-[12px] text-text-3">
                <span className="size-2 rounded-full bg-signal" style={{ opacity: 1 - j * 0.11 }} />
                {t(`kind.${k}` as "kind.artist")}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-6">
        {[...months.entries()].map(([m, list]) => (
          <div key={m} className="flex flex-col gap-3">
            <h3 className="font-heading text-[16px]">
              {format.dateTime(new Date(Date.UTC(year, m, 1)), { month: "long" })}
              <span className="ms-2 text-[13px] font-normal text-text-3">{list.length}</span>
            </h3>
            <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6">
              {list.map((s) => {
                const Icon = ICON[s.kind]
                const body = (
                  <>
                    <span
                      className="relative grid size-18 place-items-center rounded-full border-2 border-dashed border-signal/60 p-1"
                      style={{ transform: `rotate(${tilt(s.id)}deg)` }}
                    >
                      {s.image ? (
                        // biome-ignore lint/performance/noImgElement: remote artwork
                        <img
                          src={sized(s.image, 160) ?? ""}
                          alt=""
                          className="size-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid size-full place-items-center rounded-full bg-signal/12 text-signal">
                          <Icon className="size-6" />
                        </span>
                      )}
                      <span className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full bg-background ring-2 ring-signal/60">
                        <Icon className="size-3 text-signal" />
                      </span>
                    </span>
                    <span className="line-clamp-2 text-center text-[11px] leading-tight font-semibold">
                      {s.title}
                    </span>
                  </>
                )
                return (
                  <li key={s.id} className="flex flex-col items-center gap-1.5">
                    {s.href ? (
                      <Link href={s.href} className="flex flex-col items-center gap-1.5">
                        {body}
                      </Link>
                    ) : s.qlooId && s.type ? (
                      <OpenThing
                        thing={{ qlooId: s.qlooId, type: s.type, name: s.title, image: s.image }}
                        surface="passport"
                        className="flex flex-col items-center gap-1.5"
                      >
                        {body}
                      </OpenThing>
                    ) : (
                      body
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {!stamps.length ? <p className="text-[14px] text-text-3">{t("empty")}</p> : null}
      </section>
    </div>
  )
}
