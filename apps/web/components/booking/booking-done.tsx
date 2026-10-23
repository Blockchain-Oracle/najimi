"use client"

import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { Check, Loader2, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { celebrate } from "@/components/games/confetti"
import type { BookingView } from "@/lib/bookings"
import { api } from "@/lib/fetcher"

/*
 * Back from the payment sheet: the booking is made (once, however often this page loads), then
 * shown as a ticket: confirmed with its code, or failed with why. Cancellable from here while the
 * policy allows.
 */

const dateOf = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : ""

export function BookingDone({ initial }: { initial: BookingView }) {
  const t = useTranslations("Booking")
  const still = useReducedMotion()
  const [booking, setBooking] = useState(initial)
  const [cancelling, setCancelling] = useState(false)
  const asked = useRef(false)

  useEffect(() => {
    if (asked.current || initial.status !== "prebooked") return
    asked.current = true
    api<{ booking: BookingView | null }>(`/api/bookings/${initial.id}/complete`, { json: {} })
      .then((r) => {
        if (r.booking) setBooking(r.booking)
        if (r.booking?.status === "confirmed") void celebrate()
      })
      .catch((e: Error) => toast(e.message))
  }, [initial])

  const cancel = async () => {
    setCancelling(true)
    try {
      const r = await api<{ booking: BookingView | null }>(`/api/bookings/${booking.id}/cancel`, {
        json: {},
      })
      if (r.booking) setBooking(r.booking)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setCancelling(false)
    }
  }

  const working = booking.status === "prebooked" || booking.status === "paid"
  const ok = booking.status === "confirmed"
  const data = booking.data as { refundable?: boolean; freeUntil?: string | null }

  return (
    <main className="dark grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <motion.div
        initial={still ? false : { opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex w-full max-w-md flex-col items-center gap-5 text-center"
      >
        {working ? (
          <>
            <Orb size={96} working />
            <h1 className="font-title text-title-sm">{t("booking")}</h1>
            <p className="text-[15px] text-text-2">{t("bookingHint")}</p>
          </>
        ) : (
          <>
            <span
              className={`grid size-20 place-items-center rounded-full ${ok ? "bg-success" : booking.status === "cancelled" ? "bg-white/10" : "bg-danger"} text-black`}
            >
              {ok ? (
                <Check className="size-10" strokeWidth={3} />
              ) : (
                <X className="size-10" strokeWidth={3} />
              )}
            </span>
            <h1 className="font-title text-title-sm">
              {ok ? t("confirmed") : booking.status === "cancelled" ? t("cancelled") : t("failed")}
            </h1>
            <div className="w-full overflow-hidden rounded-sheet bg-card text-start">
              {booking.image ? (
                // biome-ignore lint/performance/noImgElement: the hotel's own photo
                <img src={booking.image} alt="" className="aspect-[16/7] w-full object-cover" />
              ) : null}
              <div className="flex flex-col gap-2 p-4">
                <span className="font-heading text-[17px]">{booking.title}</span>
                <span className="text-[14px] text-text-2">
                  {dateOf(booking.startsAt)} → {dateOf(booking.endsAt)} ·{" "}
                  {t("guests", { count: booking.party })}
                </span>
                {booking.confirmation ? (
                  <span className="flex items-center justify-between rounded-tile bg-white/5 px-3 py-2 text-[13px]">
                    <span className="text-text-3">{t("code")}</span>
                    <span className="font-mono font-semibold tracking-wide">
                      {booking.confirmation}
                    </span>
                  </span>
                ) : null}
                {booking.note ? (
                  <span className="text-[13px] text-text-3">{booking.note}</span>
                ) : null}
                {booking.amount ? (
                  <span className="font-title text-[1.4rem]">
                    {booking.amount.toLocaleString(undefined, {
                      style: "currency",
                      currency: booking.currency ?? "USD",
                    })}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Link
                href="/c"
                className="flex h-12 items-center justify-center rounded-pill bg-foreground font-heading text-[15px] text-background"
              >
                {t("back")}
              </Link>
              {ok && data.refundable ? (
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => void cancel()}
                  className="flex h-11 items-center justify-center gap-2 rounded-pill text-[14px] font-semibold text-text-2"
                >
                  {cancelling ? <Loader2 className="size-4 animate-spin" /> : null}
                  {data.freeUntil ? t("cancelFree", { date: dateOf(data.freeUntil) }) : t("cancel")}
                </button>
              ) : null}
            </div>
          </>
        )}
      </motion.div>
    </main>
  )
}
