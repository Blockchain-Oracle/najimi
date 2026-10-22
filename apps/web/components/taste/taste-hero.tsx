"use client"

import type { TasteWords } from "@najimi/db/schema"
import { cn } from "@najimi/ui/lib/utils"
import { BookOpen, Compass, Eye, MapPin, Moon, Sofa, UtensilsCrossed } from "lucide-react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { Face, IDENTITY_BG } from "./face"
import { type CardLove, LovesFan } from "./taste-card"

/*
 * The top of a taste page: the person on their colour, their face large, and their taste read
 * aloud in one line made of Qloo's own words ("Minimalist looks, homey rooms, warm nights,
 * Caribbean plates."). Their loves fan out along the bottom edge.
 */

const lower = (w: string | undefined) => w?.toLocaleLowerCase()
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Qloo tags that say little about a person in a sentence ("tourist friendly nights"). */
const GENERIC = new Set([
  "tourist friendly",
  "trendy",
  "popular",
  "casual",
  "professional",
  "bustling",
])
const telling = (list: string[] | undefined) =>
  list?.find((w) => !GENERIC.has(w.toLocaleLowerCase())) ?? list?.[0]

/** One sentence from a telling word of each family, or the words in a row when some are missing. */
export function useTasteLine(words: TasteWords | null): string | null {
  const t = useTranslations("Taste")
  if (!words) return null
  const look = telling(words.aesthetic)
  const rooms = telling(words.decor)
  const mood = telling(words.ambience)
  const food = telling(words.cuisine)
  if (look && rooms && mood && food)
    return capital(
      t("line", {
        look: lower(look) ?? "",
        rooms: lower(rooms) ?? "",
        mood: lower(mood) ?? "",
        food,
      }),
    )
  const some = [look, rooms, mood, food].filter((w): w is string => Boolean(w))
  return some.length ? some.join(" · ") : null
}

export function TasteHero({
  person,
  identity,
  look,
  words,
  loves,
  live,
}: {
  person: { name: string; isSelf: boolean; city: string | null }
  identity: string
  look: string | null
  words: TasteWords | null
  loves: CardLove[]
  live: boolean
}) {
  const t = useTranslations("Taste")
  const line = useTasteLine(words)
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-sheet text-black shadow-paper",
        IDENTITY_BG[identity] ?? "bg-violet",
      )}
    >
      <div className="flex flex-col gap-5 p-6 pb-2">
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.7, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
          >
            <Face
              look={look}
              identity={identity}
              name={person.name}
              size="xl"
              className="ring-black/10"
            />
          </motion.div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[11px] font-semibold tracking-wide uppercase opacity-70">
              {person.isSelf ? t("mine") : t("theirs", { name: person.name })}
            </p>
            <h1 className="truncate font-title text-5xl leading-none">{person.name}</h1>
            {person.city ? (
              <p className="flex items-center gap-1 text-sm font-semibold opacity-75">
                <MapPin className="size-3.5" /> {person.city}
              </p>
            ) : null}
          </div>
        </div>
        {line ? (
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl font-title text-2xl leading-tight"
          >
            {line}
          </motion.p>
        ) : live ? (
          <p className="flex items-center gap-2 font-title text-2xl opacity-70">
            <span className="size-2.5 animate-lime-pulse rounded-full bg-black" /> {t("computing")}
          </p>
        ) : null}
      </div>
      <LovesFan identity={identity} loves={loves} bare />
    </section>
  )
}

/** Each family of words with its own mark and tint, so the palette reads at a glance. */
const FAMILIES = [
  { key: "aesthetic", icon: Eye, tint: "bg-violet/15", dot: "bg-violet" },
  { key: "decor", icon: Sofa, tint: "bg-butter/25", dot: "bg-butter" },
  { key: "ambience", icon: Moon, tint: "bg-pink/15", dot: "bg-pink" },
  { key: "style", icon: BookOpen, tint: "bg-cobalt/15", dot: "bg-cobalt" },
  { key: "cuisine", icon: UtensilsCrossed, tint: "bg-orange/15", dot: "bg-orange" },
  { key: "lifestyle", icon: Compass, tint: "bg-teal/15", dot: "bg-teal" },
] as const

export function WordPalette({
  words,
  labels,
}: {
  words: TasteWords
  labels: Record<string, string>
}) {
  return (
    <dl className="flex flex-col gap-4">
      {FAMILIES.filter((f) => words[f.key]?.length).map((f, row) => {
        const Icon = f.icon
        return (
          <div key={f.key} className="flex flex-col gap-2">
            <dt className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
              <span className={cn("grid size-5 place-items-center rounded-full text-black", f.dot)}>
                <Icon className="size-3" />
              </span>
              {labels[f.key]}
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {words[f.key].slice(0, 6).map((w, i) => (
                <motion.span
                  key={w}
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: row * 0.08 + i * 0.04,
                    type: "spring",
                    stiffness: 300,
                    damping: 22,
                  }}
                  className={cn("rounded-pill px-2.5 py-1 text-[13px] font-medium", f.tint)}
                >
                  {w}
                </motion.span>
              ))}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
