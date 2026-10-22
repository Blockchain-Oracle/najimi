"use client"

import type { TasteWords } from "@najimi/db/schema"
import {
  BookOpen,
  ChevronRight,
  Clapperboard,
  Gem,
  MapPinned,
  Music2,
  Plane,
  ScanFace,
  UtensilsCrossed,
} from "lucide-react"
import { useTranslations } from "next-intl"
import type { CSSProperties } from "react"
import { Face } from "@/components/taste/face"
import { useTasteLine } from "@/components/taste/taste-hero"
import { sound } from "@/lib/sounds"
import type { ChatPerson } from "./composer"

/*
 * An empty chat, before the first word: who it's for (their face and the taste it will use, in
 * Qloo's own words, beside the loves it came from) and a few first asks picked from what they
 * love. Quiet rows on a panel: the colour on this screen is
 * the person's face and their artwork, nothing else.
 */

export type Starter = { key: string; text: string }
export type WelcomeTaste = {
  words: TasteWords | null
  loves: { name: string; imageUrl: string | null }[]
}

/** Each starter's mark, in ink: what kind of thing it asks for. */
const STARTER_ICON: Record<string, typeof Gem> = {
  whoAmI: ScanFace,
  fitIn: MapPinned,
  nextRead: BookOpen,
  playlist: Music2,
  watch: Clapperboard,
  eat: UtensilsCrossed,
  hidden: Gem,
  trip: Plane,
}

/*
 * Entrances are CSS, not motion: they play from the first paint of the server's HTML, so nothing
 * waits on JavaScript to become visible.
 */
const enter = (i: number) => ({ "--enter-delay": `${80 + i * 40}ms` }) as CSSProperties

const row =
  "flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors duration-200 hover:bg-white/4 focus-visible:bg-white/4 focus-visible:outline-none"

export function ChatWelcome({
  person,
  greeting,
  taste,
  starters,
  onAsk,
}: {
  person: ChatPerson | undefined
  greeting: string
  taste: WelcomeTaste
  starters: Starter[]
  onAsk: (text: string) => void
}) {
  const t = useTranslations("Chat")
  const line = useTasteLine(taste.words)
  return (
    <section className="flex flex-1 flex-col justify-end gap-6 py-8 md:justify-center">
      <header className="flex animate-settle-in flex-col gap-3" style={enter(0)}>
        {person ? <Face look={person.look} name={person.name} size="md" /> : null}
        <h1 className="font-title text-[2rem] leading-[1.08] md:text-[2.5rem]">{greeting}</h1>
        {line ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-2">
            {taste.loves.length ? (
              <span className="flex -space-x-1.5" aria-hidden>
                {taste.loves.slice(0, 3).map((l) => (
                  <span
                    key={l.name}
                    className="size-5 overflow-hidden rounded-[4px] bg-raised ring-2 ring-background"
                  >
                    {l.imageUrl ? (
                      // biome-ignore lint/performance/noImgElement: Qloo artwork from its own CDN
                      <img src={l.imageUrl} alt="" className="size-full object-cover" />
                    ) : null}
                  </span>
                ))}
              </span>
            ) : null}
            <span>
              {t("usesTaste", { self: person?.isSelf ? "yes" : "no", name: person?.name ?? "" })}{" "}
              <span className="text-foreground">{line}</span>
            </span>
          </p>
        ) : null}
      </header>

      <div
        className="grid animate-settle-in overflow-hidden rounded-card bg-card shadow-paper md:grid-cols-2"
        style={enter(1)}
      >
        {starters.map((s, i) => {
          const Icon = STARTER_ICON[s.key] ?? Gem
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                sound("tap")
                onAsk(s.text)
              }}
              className={`${row} group border-border ${i ? "border-t" : ""} md:border-t-0 md:[&:nth-child(n+3)]:border-t md:even:border-s`}
            >
              <Icon className="size-4 shrink-0 text-text-3" strokeWidth={1.5} />
              <span className="text-[15px] leading-snug">{s.text}</span>
              <ChevronRight className="ms-auto size-4 shrink-0 text-text-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
            </button>
          )
        })}
      </div>
    </section>
  )
}
