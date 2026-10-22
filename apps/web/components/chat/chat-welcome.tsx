"use client"

import type { TasteWords } from "@najimi/db/schema"
import { cn } from "@najimi/ui/lib/utils"
import {
  ArrowUpRight,
  BookOpen,
  Clapperboard,
  Gem,
  MapPinned,
  Music2,
  Plane,
  ScanFace,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react"
import { useTranslations } from "next-intl"
import type { CSSProperties } from "react"
import { Face } from "@/components/taste/face"
import { useTasteLine } from "@/components/taste/taste-hero"
import { WORKFLOW_LOOK, WORKFLOW_SLUGS } from "@/components/workflows/workflow-meta"
import { sound } from "@/lib/sounds"
import type { ChatPerson } from "./composer"

/*
 * An empty chat, before the first word: who it's for (their face and the taste it will use, in
 * Qloo's own words), a few first asks picked from what they love, and the workflows laid out as
 * tiles rather than tucked in a menu.
 */

export type Starter = { key: string; text: string }
export type WelcomeTaste = {
  words: TasteWords | null
  loves: { name: string; imageUrl: string | null }[]
}

/** Each starter wears the mark and colour of the kind of thing it asks for. */
const STARTER_LOOK: Record<string, { icon: typeof Gem; tone: string }> = {
  whoAmI: { icon: ScanFace, tone: "bg-violet" },
  fitIn: { icon: MapPinned, tone: "bg-teal" },
  nextRead: { icon: BookOpen, tone: "bg-butter" },
  playlist: { icon: Music2, tone: "bg-pink" },
  watch: { icon: Clapperboard, tone: "bg-cobalt" },
  eat: { icon: UtensilsCrossed, tone: "bg-orange" },
  both: { icon: UsersRound, tone: "bg-pink" },
  hidden: { icon: Gem, tone: "bg-lime" },
  trip: { icon: Plane, tone: "bg-cobalt" },
}

/*
 * Entrances are CSS, not motion: they play from the first paint of the server's HTML, so nothing
 * waits on JavaScript to become visible. `card-land` moves `transform`, which leaves the hover
 * lift (Tailwind's `translate`) free.
 */
const enter = (i: number) =>
  ({ animationDelay: `${120 + i * 50}ms`, "--enter-delay": `${120 + i * 50}ms` }) as CSSProperties

export function ChatWelcome({
  person,
  greeting,
  taste,
  starters,
  onAsk,
  onWorkflow,
}: {
  person: ChatPerson | undefined
  greeting: string
  taste: WelcomeTaste
  starters: Starter[]
  onAsk: (text: string) => void
  onWorkflow: (slug: string) => void
}) {
  const t = useTranslations("Chat")
  const tw = useTranslations("Workflows")
  const line = useTasteLine(taste.words)
  return (
    <section className="flex flex-1 flex-col justify-center gap-7 py-8">
      <header className="flex items-center gap-4">
        {person ? (
          <div className="animate-card-land" style={{ "--tilt": "-4deg" } as CSSProperties}>
            <Face
              look={person.look}
              identity={person.identity}
              name={person.name}
              size="lg"
              className="ring-background"
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-title text-title-sm leading-[1.05]">{greeting}</h1>
          {line ? (
            <p
              style={enter(0)}
              className="flex animate-settle-in flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-2"
            >
              {taste.loves.length ? (
                <span className="flex -space-x-2" aria-hidden>
                  {taste.loves.slice(0, 4).map((l) => (
                    <span
                      key={l.name}
                      className="size-6 overflow-hidden rounded-full bg-ash ring-2 ring-background"
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
                {t("usesTaste", {
                  self: person?.isSelf ? "yes" : "no",
                  name: person?.name ?? "",
                })}{" "}
                <span className="font-semibold text-foreground">{line}</span>
              </span>
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {starters.map((s, i) => {
          const look = STARTER_LOOK[s.key] ?? { icon: Gem, tone: "bg-lime" }
          const Icon = look.icon
          return (
            <button
              key={s.key}
              type="button"
              style={enter(i + 1)}
              onClick={() => {
                sound("tap")
                onAsk(s.text)
              }}
              className="group flex animate-card-land items-center gap-3 rounded-card bg-card p-2.5 pe-3.5 text-start text-card-foreground shadow-sticker transition-[translate,box-shadow] duration-200 ease-glide hover:-translate-y-0.5 hover:shadow-sticker-lift focus-visible:-translate-y-0.5 focus-visible:shadow-sticker-lift focus-visible:outline-2 focus-visible:outline-lime"
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-tile text-black transition-transform duration-300 ease-snap group-hover:-rotate-6",
                  look.tone,
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="text-[15px] leading-snug font-medium">{s.text}</span>
              <ArrowUpRight className="ms-auto size-4 shrink-0 text-paper-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          )
        })}
      </div>

      <div style={enter(starters.length + 1)} className="flex animate-settle-in flex-col gap-2.5">
        <p className="flex items-baseline justify-between gap-3 text-[11px] font-semibold tracking-wide text-text-3 uppercase">
          {tw("title")}
        </p>
        {/* On a phone, a row that scrolls sideways and bleeds to the screen edge so it reads as more;
            wider, a grid with every one in view. */}
        <div className="-mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pt-1 pb-3 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {WORKFLOW_SLUGS.map((slug, i) => {
            const look = WORKFLOW_LOOK[slug]
            const Icon = look?.icon
            return (
              <button
                key={slug}
                type="button"
                onClick={() => {
                  sound("tap")
                  onWorkflow(slug)
                }}
                className={cn(
                  "flex w-40 shrink-0 snap-start flex-col gap-2 rounded-card p-3.5 md:w-auto text-start text-black shadow-sticker transition-[translate,rotate,box-shadow] duration-200 ease-glide hover:-translate-y-1 hover:shadow-sticker-lift focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
                  i % 2 ? "hover:rotate-1" : "hover:-rotate-1",
                  look?.tone,
                )}
              >
                <span className="grid size-8 place-items-center rounded-full bg-black/10">
                  {Icon ? <Icon className="size-4" /> : null}
                </span>
                <span className="font-title text-lg leading-tight">
                  {tw(`items.${slug}.name` as "items.night-in.name")}
                </span>
                <span className="line-clamp-3 text-xs leading-snug opacity-75">
                  {tw(`items.${slug}.desc` as "items.night-in.desc")}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
