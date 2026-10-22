"use client"

import type { TasteWords } from "@najimi/db/schema"
import { Orb } from "@najimi/ui/components/orb"
import {
  BookOpen,
  Clapperboard,
  Gem,
  MapPinned,
  Music2,
  Plane,
  ScanFace,
  Store,
  UtensilsCrossed,
} from "lucide-react"
import type { CSSProperties } from "react"
import { sound } from "@/lib/sounds"

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
  business: Store,
}

/*
 * Entrances are CSS, not motion: they play from the first paint of the server's HTML, so nothing
 * waits on JavaScript to become visible.
 */
const enter = (i: number) => ({ "--enter-delay": `${80 + i * 40}ms` }) as CSSProperties

export function ChatWelcome({
  greeting,
  taste,
  starters,
  onAsk,
}: {
  greeting: string
  taste: WelcomeTaste
  starters: Starter[]
  onAsk: (text: string) => void
}) {
  return (
    <section className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <header className="flex animate-settle-in flex-col items-center gap-4" style={enter(0)}>
        <Orb size={88} colors={undefined} />
        <h1 className="font-title max-w-md text-[1.75rem] leading-[1.1] md:text-[2.25rem]">
          {greeting}
        </h1>
        {taste.loves.length ? (
          <span className="flex -space-x-2" aria-hidden>
            {taste.loves.slice(0, 5).map((l) => (
              <span
                key={l.name}
                className="size-8 overflow-hidden rounded-full bg-card ring-2 ring-background"
              >
                {l.imageUrl ? (
                  // biome-ignore lint/performance/noImgElement: Qloo artwork from its own CDN
                  <img src={l.imageUrl} alt="" className="size-full object-cover" />
                ) : null}
              </span>
            ))}
          </span>
        ) : null}
      </header>

      {/* A few first asks, picked from what they love: tap one to send it. */}
      <div
        className="flex max-w-xl animate-settle-in flex-wrap justify-center gap-2"
        style={enter(1)}
      >
        {starters.map((s) => {
          const Icon = STARTER_ICON[s.key] ?? Gem
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                sound("tap")
                onAsk(s.text)
              }}
              className="inline-flex items-center gap-2 rounded-pill bg-card px-4 py-2.5 text-[14px] font-medium text-text-2 ring-1 ring-border transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.75} />
              {s.text}
            </button>
          )
        })}
      </div>
    </section>
  )
}
