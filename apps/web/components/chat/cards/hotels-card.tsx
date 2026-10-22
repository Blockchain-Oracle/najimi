"use client"

import type { NajimiTools } from "@najimi/agent"
import { toast } from "@najimi/ui/components/sonner"
import { Loader2, Star } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"
import { useChatId } from "../chat-context"

/*
 * Rooms with real prices (W18), side by side: the photo, stars and guest rating, the price for the
 * whole stay, and whether it's refundable. Book holds the price with Nuitee and opens its payment
 * sheet. After Booking-style result cards and SeatGeek's checkout sheet (Refero b584bf27).
 */

type Output = NajimiTools["findHotels"]["output"]

const nightsOf = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000))

export function HotelsCard({ output }: { output: Output }) {
  const t = useTranslations("Booking")
  const router = useRouter()
  const chatId = useChatId()
  const [holding, setHolding] = useState<string | null>(null)
  if (!output.offers.length)
    return (
      <p className="rounded-card bg-card px-4 py-3 text-sm text-text-2">
        {output.note ?? t("noRooms")}
      </p>
    )
  const nights = nightsOf(output.checkin, output.checkout)

  const hold = async (o: Output["offers"][number]) => {
    setHolding(o.offerId)
    try {
      const { bookingId } = await api<{ bookingId: string }>("/api/bookings/hotel", {
        json: {
          offerId: o.offerId,
          hotel: {
            hotelId: o.hotelId,
            name: o.name,
            photo: o.photo,
            address: o.address,
            stars: o.stars,
            rating: o.rating,
          },
          checkin: output.checkin,
          checkout: output.checkout,
          guests: output.guests,
          ...(chatId ? { chatId } : {}),
        },
      })
      router.push(`/pay/${bookingId}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
      setHolding(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <span className="text-[13px] text-text-3">
        {t("stay", { near: output.near, nights, guests: output.guests })}
      </span>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {output.offers.map((o) => (
          <article
            key={o.offerId}
            className="dark flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-card bg-[#0b0b0d] text-foreground ring-1 ring-white/10"
          >
            {o.photo ? (
              // biome-ignore lint/performance/noImgElement: the hotel's own photo
              <img src={o.photo} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <span className="aspect-[4/3] w-full bg-white/5" />
            )}
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 text-[15px] font-semibold leading-tight">
                  {o.name}
                </span>
                {o.rating ? (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-pill bg-signal-soft px-2 py-0.5 text-[12px] font-bold text-signal">
                    <Star className="size-3 fill-current" />
                    {o.rating}
                  </span>
                ) : null}
              </div>
              {o.stars ? (
                <span className="text-[12px] text-text-3">{"★".repeat(Math.round(o.stars))}</span>
              ) : null}
              <span className="text-[12px] text-text-3">
                {[o.room, o.board].filter(Boolean).join(" · ")}
              </span>
              <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                <span className="flex flex-col">
                  <span className="font-title text-[20px] leading-none">
                    {o.price.amount.toLocaleString(undefined, {
                      style: "currency",
                      currency: o.price.currency,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span
                    className={
                      o.refundable ? "text-[11px] text-success" : "text-[11px] text-text-3"
                    }
                  >
                    {o.refundable ? t("refundable") : t("nonRefundable")}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={holding !== null}
                  onClick={() => void hold(o)}
                  className="flex h-9 items-center gap-1.5 rounded-pill bg-foreground px-4 text-[13px] font-semibold text-background disabled:opacity-50"
                >
                  {holding === o.offerId ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("book")}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
