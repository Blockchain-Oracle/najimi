"use client"

import { toast } from "@najimi/ui/components/sonner"
import {
  BedDouble,
  Gamepad2,
  Heart,
  Link2,
  Loader2,
  Moon,
  Plane,
  Share,
  Ticket,
  UtensilsCrossed,
} from "lucide-react"
import Link from "next/link"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { sized } from "@/components/connect/platforms"
import { api } from "@/lib/fetcher"
import type { Stamp, StampKind, Upcoming } from "@/lib/passport"
import { sound } from "@/lib/sounds"

/*
 * The Taste Passport (W21) and its Wrapped (W22). The year in numbers; the story set as cards you
 * swipe and send straight to Stories (Web Share with the five pictures, TIDAL's share sheet,
 * Refero f479022c); how the taste moved month by month; then every stamp, inked where it fell.
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
  const share = async () => {
    if (!token) return
    setBusy(true)
    try {
      const files = await Promise.all(
        SLIDES.map(async (n) => {
          const blob = await fetch(`/api/og/wrapped/${token}/${n}`).then((r) => r.blob())
          return new File([blob], `najimi-wrapped-${n}.png`, { type: "image/png" })
        }),
      )
      const url = `${window.location.origin}/wrapped/${token}`
      if (navigator.canShare?.({ files })) await navigator.share({ files, title: t("title") })
      else if (navigator.share) await navigator.share({ url, title: t("title") })
      else {
        // No share sheet here (desktop): save the pictures instead.
        for (const f of files) {
          const a = document.createElement("a")
          a.href = URL.createObjectURL(f)
          a.download = f.name
          a.click()
        }
        toast(t("saved"))
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast(t("failed"))
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    if (!token) return
    await navigator.clipboard
      .writeText(`${window.location.origin}/wrapped/${token}`)
      .catch(() => undefined)
    toast(t("copied"))
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
    <section className="flex flex-col gap-4">
      <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
        {SLIDES.map((n) => (
          <li key={n} className="w-[46%] max-w-56 shrink-0 snap-center sm:w-52">
            <Link href={`/wrapped/${token}?s=${n}`}>
              {/* biome-ignore lint/performance/noImgElement: our own generated story slide */}
              <img
                src={`/api/og/wrapped/${token}/${n}`}
                alt={t("slide", { n })}
                loading={n > 2 ? "lazy" : "eager"}
                className="aspect-[9/16] w-full rounded-card object-cover ring-1 ring-white/10"
              />
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void share()}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-pill bg-foreground font-heading text-[15px] text-background"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Share className="size-5" />}
          {t("share")}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={t("copyLink")}
          className="grid size-12 place-items-center rounded-full bg-card ring-1 ring-border"
        >
          <Link2 className="size-5" />
        </button>
      </div>
    </section>
  )
}

export function PassportView({
  year,
  stamps,
  movement,
  wrappedToken,
  personId,
  upcoming,
}: {
  year: number
  stamps: Stamp[]
  /** Plans and bookings still to come. */
  upcoming: Upcoming[]
  movement: Record<string, number>[]
  wrappedToken: string | null
  personId: string
}) {
  const t = useTranslations("Passport")
  const format = useFormatter()
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
      <header className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <h1 className="font-title text-[2rem] leading-none">{t("title")}</h1>
          <span className="font-title text-[2rem] leading-none text-text-3">{year}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { n: count(["love"]), k: t("loves") },
            { n: count(["night", "table", "show"]), k: t("nights") },
            { n: count(["trip", "stay"]), k: t("trips") },
            { n: count(["game"]), k: t("games") },
          ].map((s) => (
            <div
              key={s.k}
              className="flex flex-col rounded-tile bg-card px-3 py-3 ring-1 ring-border"
            >
              <span className="font-title text-[26px] leading-none tabular-nums">{s.n}</span>
              <span className="mt-1 truncate text-[11px] font-semibold text-text-3">{s.k}</span>
            </div>
          ))}
        </div>
      </header>

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
