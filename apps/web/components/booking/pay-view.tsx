"use client"

import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { BedDouble, CalendarDays, Loader2, ShieldCheck, Star, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import type { BookingView } from "@/lib/bookings"
import { api } from "@/lib/fetcher"

/*
 * Paying for a held room (W18): who it's for, then Nuitee's own payment sheet in the page (Nuitee
 * is the merchant of record and takes the card; Najimi never sees it). The sheet comes back to
 * the done page, which makes the booking.
 */

declare global {
  interface Window {
    LiteAPIPayment?: new (config: Record<string, unknown>) => { handlePayment: () => void }
  }
}

const SDK = "https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1"

const dateOf = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : ""

function loadSdk(): Promise<void> {
  if (window.LiteAPIPayment) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK}"]`)
    const script = existing ?? document.createElement("script")
    script.src = SDK
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("The payment sheet didn't load"))
    if (!existing) document.head.appendChild(script)
  })
}

export function PayView({
  booking,
  secretKey,
  holder: initial,
}: {
  booking: BookingView
  secretKey: string
  holder: Record<string, string>
}) {
  const t = useTranslations("Booking")
  const [step, setStep] = useState<"who" | "pay">(initial.firstName ? "pay" : "who")
  const [holder, setHolder] = useState({
    firstName: initial.firstName ?? "",
    lastName: initial.lastName ?? "",
    email: initial.email ?? "",
    phone: initial.phone ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const mounted = useRef(false)
  const nights =
    booking.startsAt && booking.endsAt
      ? Math.max(
          1,
          Math.round(
            (new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) /
              86_400_000,
          ),
        )
      : 1
  const data = booking.data as {
    refundable?: boolean
    freeUntil?: string | null
    address?: string | null
    stars?: number | null
    rating?: number | null
    changed?: { pricePercent: number }
  }

  useEffect(() => {
    if (step !== "pay" || mounted.current) return
    mounted.current = true
    setLoading(true)
    loadSdk()
      .then(() => {
        const Pay = window.LiteAPIPayment
        if (!Pay) throw new Error("The payment sheet didn't load")
        new Pay({
          // Real payments only (Nuitee's sheet is merchant of record).
          publicKey: "live",
          appearance: { theme: "flat" },
          options: { business: { name: "Najimi" } },
          targetElement: "#nuitee-pay",
          secretKey,
          returnUrl: `${window.location.origin}/pay/${booking.id}/done`,
        }).handlePayment()
      })
      .catch((e: Error) => toast(e.message))
      .finally(() => setLoading(false))
  }, [step, secretKey, booking.id])

  const save = async () => {
    setSaving(true)
    try {
      await api(`/api/bookings/${booking.id}/holder`, { json: holder })
      setStep("pay")
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof typeof holder, label: string, type = "text", auto?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-text-3">{label}</span>
      <input
        type={type}
        autoComplete={auto}
        value={holder[key]}
        onChange={(e) => setHolder((h) => ({ ...h, [key]: e.target.value }))}
        className="h-12 rounded-tile bg-card px-4 text-[16px] outline-none ring-1 ring-border focus:ring-2 focus:ring-signal"
      />
    </label>
  )

  return (
    <main className="dark min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-[max(env(safe-area-inset-top),20px)] pb-10">
        <div className="relative overflow-hidden rounded-sheet bg-card">
          {booking.image ? (
            // biome-ignore lint/performance/noImgElement: the hotel's own photo
            <img src={booking.image} alt="" className="aspect-[16/9] w-full object-cover" />
          ) : null}
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <h1 className="font-title text-[1.6rem] leading-tight">{booking.title}</h1>
                {data.address ? (
                  <span className="text-[13px] text-text-3">{data.address}</span>
                ) : null}
              </div>
              {data.rating ? (
                <span className="flex shrink-0 items-center gap-1 rounded-pill bg-signal-soft px-2.5 py-1 text-[13px] font-bold text-signal">
                  <Star className="size-3.5 fill-current" /> {data.rating}
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[13px]">
              <span className="flex items-center gap-1.5 rounded-tile bg-white/5 px-2.5 py-2">
                <CalendarDays className="size-4 text-text-3" /> {dateOf(booking.startsAt)}
              </span>
              <span className="flex items-center gap-1.5 rounded-tile bg-white/5 px-2.5 py-2">
                <BedDouble className="size-4 text-text-3" /> {t("nights", { count: nights })}
              </span>
              <span className="flex items-center gap-1.5 rounded-tile bg-white/5 px-2.5 py-2">
                <Users className="size-4 text-text-3" /> {t("guests", { count: booking.party })}
              </span>
            </div>
            <div className="flex items-end justify-between border-t border-line pt-3">
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  data.refundable ? "text-success" : "text-text-3",
                )}
              >
                {data.refundable
                  ? data.freeUntil
                    ? t("freeUntil", { date: dateOf(data.freeUntil) })
                    : t("refundable")
                  : t("nonRefundable")}
              </span>
              <span className="font-title text-[1.6rem] leading-none">
                {booking.amount?.toLocaleString(undefined, {
                  style: "currency",
                  currency: booking.currency ?? "USD",
                })}
              </span>
            </div>
            {data.changed?.pricePercent ? (
              <p className="text-[12px] text-warn">
                {t("priceMoved", { percent: data.changed.pricePercent })}
              </p>
            ) : null}
          </div>
        </div>

        {step === "who" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
            className="flex flex-col gap-3"
          >
            <h2 className="font-heading text-[17px]">{t("whoFor")}</h2>
            <div className="grid grid-cols-2 gap-3">
              {field("firstName", t("firstName"), "text", "given-name")}
              {field("lastName", t("lastName"), "text", "family-name")}
            </div>
            {field("email", t("email"), "email", "email")}
            {field("phone", t("phone"), "tel", "tel")}
            <button
              type="submit"
              disabled={
                saving || !holder.firstName || !holder.lastName || !holder.email || !holder.phone
              }
              className="mt-1 flex h-13 items-center justify-center gap-2 rounded-pill bg-foreground py-3.5 font-heading text-[16px] text-background disabled:opacity-40"
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : null}
              {t("toPayment")}
            </button>
          </form>
        ) : (
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-[17px]">{t("pay")}</h2>
            <div className="min-h-64 rounded-sheet bg-white p-3 text-black">
              {loading ? (
                <div className="grid h-60 place-items-center">
                  <Loader2 className="size-6 animate-spin text-black/50" />
                </div>
              ) : null}
              <div id="nuitee-pay" />
            </div>
            <p className="flex items-center gap-2 text-[12px] text-text-3">
              <ShieldCheck className="size-4 shrink-0" />
              {t("merchant")}
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
