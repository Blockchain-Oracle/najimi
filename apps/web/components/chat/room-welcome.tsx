"use client"

import { Orb } from "@najimi/ui/components/orb"
import { Clapperboard, MapPinned, Music2 } from "lucide-react"
import { useTranslations } from "next-intl"

/*
 * An empty circle or DM: say hi, and Najimi is a mention away. The chips call it with the asks it
 * answers for the whole room (a spot tonight, a film, music), each scored for everyone in it.
 */
export function RoomWelcome({ name, onAsk }: { name: string; onAsk: (text: string) => void }) {
  const t = useTranslations("Chat")
  const asks = [
    { icon: MapPinned, text: t("askSpot") },
    { icon: Clapperboard, text: t("askFilm") },
    { icon: Music2, text: t("askMusic") },
  ]
  return (
    <section className="flex min-h-full flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <Orb size={72} />
      <h2 className="font-title max-w-sm text-[1.6rem] leading-tight">
        {t("roomHello", { name })}
      </h2>
      <p className="max-w-xs text-[14px] text-text-3">{t("roomHint")}</p>
      <div className="flex max-w-md flex-wrap justify-center gap-2">
        {asks.map((a) => (
          <button
            key={a.text}
            type="button"
            onClick={() => onAsk(a.text)}
            className="inline-flex items-center gap-2 rounded-pill bg-card px-4 py-2.5 text-[14px] font-medium text-text-2 ring-1 ring-border transition-colors hover:bg-secondary hover:text-foreground"
          >
            <a.icon className="size-4" strokeWidth={1.75} />
            {a.text}
          </button>
        ))}
      </div>
    </section>
  )
}
