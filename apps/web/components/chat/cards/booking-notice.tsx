"use client"

import type { BookingNote } from "@najimi/agent"
import { calendarLinks } from "@najimi/booking/ics"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { BedDouble, CalendarPlus, Pause, Phone, Play, Ticket, UtensilsCrossed } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { usePlayer } from "@/components/player/player"
import { api } from "@/lib/fetcher"
import { useMe } from "../chat-context"

const ICON = { hotel: BedDouble, table: UtensilsCrossed, show: Ticket } as const
const TONE: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  paid: "bg-amber-500/15 text-amber-200",
  calling: "bg-sky-500/15 text-sky-200",
  failed: "bg-rose-500/15 text-rose-300",
  cancelled: "bg-white/10 text-text-2",
}

/**
 * A booking's news in the room, as a card: what, when, where it stands, the confirmation, and
 * what its owner can do (add it to a calendar, cancel a refundable stay).
 */
export function BookingNotice({ note, text }: { note: BookingNote; text: string }) {
  const t = useTranslations("Bookings")
  const me = useMe()
  const [status, setStatus] = useState(note.status)
  const [busy, setBusy] = useState(false)
  const mine = me === note.ownerId
  const Icon = ICON[note.kind as keyof typeof ICON] ?? Phone
  const when = note.startsAt
    ? new Date(note.startsAt).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(note.kind === "hotel" ? {} : { hour: "numeric", minute: "2-digit" }),
      })
    : null
  const cancel = async () => {
    if (!window.confirm(t("cancelSure"))) return
    setBusy(true)
    await api(`/api/bookings/${note.id}/cancel`, { json: {} })
      .then(() => setStatus("cancelled"))
      .catch((e) => toast.error(e instanceof Error ? e.message : t("cancelFailed")))
      .finally(() => setBusy(false))
  }
  return (
    <article className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-card bg-card p-3 ring-1 ring-white/8">
      <div className="flex items-center gap-3">
        {note.image ? (
          // biome-ignore lint/performance/noImgElement: the venue's own picture
          <img src={note.image} alt="" className="size-14 shrink-0 rounded-tile object-cover" />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-tile bg-white/5">
            <Icon className="size-6 text-text-3" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-heading text-[16px]">{note.venue ?? note.title}</span>
          {when ? <span className="text-[13px] text-text-3">{when}</span> : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold",
            TONE[status] ?? TONE.cancelled,
          )}
        >
          {t(`status.${status}` as "status.confirmed")}
        </span>
      </div>
      <p className="text-[14px] text-text-2">{text}</p>
      {note.recording ? <CallRecording note={note} /> : null}
      {note.confirmation ? (
        <p className="font-mono text-[12px] text-text-3">
          {t("confirmation")} {note.confirmation}
        </p>
      ) : null}
      {mine && (status === "confirmed" || status === "paid") ? (
        <div className="flex flex-wrap gap-2">
          {note.startsAt ? (
            <>
              <a
                href={googleCalendar(note)}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center gap-1.5 rounded-pill bg-white/8 px-3 text-[13px] font-semibold"
              >
                <CalendarPlus className="size-4" /> {t("googleCalendar")}
              </a>
              <a
                href={`/api/bookings/${note.id}/ics`}
                className="flex h-9 items-center gap-1.5 rounded-pill bg-white/8 px-3 text-[13px] font-semibold"
              >
                {t("otherCalendars")}
              </a>
            </>
          ) : null}
          {note.kind === "hotel" && note.refundable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancel()}
              className="flex h-9 items-center rounded-pill px-3 text-[13px] font-semibold text-rose-300 ring-1 ring-rose-400/30 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

/** The booking in Google Calendar, filled in (a table holds two hours unless it says otherwise). */
function googleCalendar(note: BookingNote) {
  const start = new Date(note.startsAt ?? Date.now())
  const end = note.endsAt ? new Date(note.endsAt) : new Date(start.getTime() + 2 * 3600_000)
  return calendarLinks({
    uid: note.id,
    title: note.venue ? `${note.title} · ${note.venue}` : note.title,
    start,
    end,
    where: note.venue,
    notes: note.confirmation
      ? `Booked through Najimi, under ${note.confirmation}.`
      : "Booked through Najimi.",
  }).google
}

/** The table call itself, played in Najimi's one player (with its seek bar and lock screen). */
function CallRecording({ note }: { note: BookingNote }) {
  const t = useTranslations("Bookings")
  const player = usePlayer()
  const id = `call_${note.id}`
  const mine = player.track?.id === id
  const playing = mine && player.playing
  return (
    <button
      type="button"
      onClick={() =>
        mine
          ? player.toggle()
          : void player.play({
              id,
              src: `/api/bookings/${note.id}/recording`,
              title: t("callWith", { venue: note.venue ?? note.title }),
              by: "Najimi",
              artwork: note.image,
              source: "podcast",
              store: null,
            })
      }
      className="flex h-11 items-center gap-3 rounded-pill bg-white/6 pr-4 pl-1.5 text-start text-[14px] font-semibold transition-colors hover:bg-white/10"
    >
      <span className="grid size-8 place-items-center rounded-full bg-foreground text-background">
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </span>
      {playing ? t("listening") : t("listen")}
    </button>
  )
}
