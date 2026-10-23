"use client"

import type { NajimiTools } from "@najimi/agent"
import { Orb } from "@najimi/ui/components/orb"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Phone, PhoneOff } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"

/*
 * A phone call Najimi wants to make for a table (W18): before it rings, exactly what it will say
 * (that it's an AI, that it's recorded, what it's asking for), and a yes or no. While it's on, a
 * calling line that follows the booking until there's an answer; the outcome itself lands in the
 * thread as a booking card.
 */

type Input = Partial<NajimiTools["callToBook"]["input"]>
type Output = NajimiTools["callToBook"]["output"]

export function CallApproval({
  input,
  onDecide,
}: {
  input: Input
  onDecide?: (approved: boolean) => void
}) {
  const t = useTranslations("Booking")
  const [deciding, setDeciding] = useState<boolean | null>(null)
  const when = input.date && input.time ? `${input.date} ${input.time}` : ""
  return (
    <section className="dark flex flex-col gap-3 rounded-card bg-[#0b0b0d] p-4 text-foreground ring-1 ring-white/10">
      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-signal-soft text-signal">
          <Phone className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] font-bold tracking-[0.08em] text-signal uppercase">
            {t("callTitle")}
          </span>
          <span className="truncate font-heading text-[16px]">{input.venue}</span>
        </div>
      </header>
      <blockquote className="rounded-tile bg-white/5 px-3 py-2.5 text-[14px] leading-snug text-text-2">
        {t("callScript", { venue: input.venue ?? "", party: input.party ?? 2, when })}
      </blockquote>
      <p className="text-[12px] text-text-3">{t("callRules")}</p>
      {onDecide ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={deciding !== null}
            onClick={() => {
              setDeciding(false)
              onDecide(false)
            }}
            className="glass flex h-11 items-center justify-center gap-2 rounded-pill text-[14px] font-semibold"
          >
            <PhoneOff className="size-4" /> {t("notNow")}
          </button>
          <button
            type="button"
            disabled={deciding !== null}
            onClick={() => {
              setDeciding(true)
              onDecide(true)
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-pill bg-foreground text-[14px] font-semibold text-background"
          >
            {deciding ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}{" "}
            {t("callNow")}
          </button>
        </div>
      ) : null}
    </section>
  )
}

export function CallCard({ input, output }: { input: Input; output: Output }) {
  const t = useTranslations("Booking")
  const ts = useTranslations("Bookings")
  const booking = useQuery({
    queryKey: ["booking", output.bookingId],
    queryFn: () =>
      api<{ status: string; live: string | null }>(`/api/bookings/${output.bookingId}`),
    enabled: output.status === "calling" && Boolean(output.bookingId),
    // Asked again only while the phone is ringing; it stops once there's an answer.
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "calling" ? false : 5_000),
  })
  if (output.status !== "calling")
    return (
      <p className="rounded-card bg-card px-4 py-3 text-sm text-text-2">
        {output.note ?? t("callFailed")}
      </p>
    )
  const done = booking.data && booking.data.status !== "calling" ? booking.data.status : null
  return (
    <section className="dark flex items-center gap-3 rounded-card bg-[#0b0b0d] p-4 text-foreground ring-1 ring-white/10">
      {done ? (
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/8">
          <Phone className="size-4" />
        </span>
      ) : (
        <Orb size={40} working />
      )}
      <div className="flex min-w-0 flex-col">
        <span className="font-heading text-[15px]">
          {done
            ? t("called", { venue: input.venue ?? "" })
            : t("calling", { venue: input.venue ?? "" })}
        </span>
        <span className="text-[13px] text-text-3">
          {done
            ? ts(`status.${done}` as "status.confirmed")
            : (booking.data?.live ?? t("callingHint"))}
        </span>
      </div>
    </section>
  )
}
