"use client"

import type { TasteWords } from "@najimi/db/schema"
import { MapPin } from "lucide-react"
import { useTranslations } from "next-intl"
import { Face } from "./face"
import { type CardLove, LovesRow } from "./taste-card"

/*
 * The top of a taste page, on the room itself: their face, their name, and their taste read aloud
 * in one serif line made of Qloo's own words ("Minimalist looks, homey rooms, warm nights,
 * Caribbean plates."), then the loves it came from, in a row.
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
  look,
  words,
  loves,
  live,
}: {
  person: { name: string; isSelf: boolean; city: string | null }
  look: string | null
  words: TasteWords | null
  loves: CardLove[]
  live: boolean
}) {
  const t = useTranslations("Taste")
  const line = useTasteLine(words)
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Face look={look} name={person.name} size="xl" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[13px] text-text-3">
            {person.isSelf ? t("mine") : t("theirs", { name: person.name })}
          </p>
          <h1 className="truncate font-title text-[2.5rem] leading-none md:text-5xl">
            {person.name}
          </h1>
          {person.city ? (
            <p className="flex items-center gap-1 font-mono text-xs text-text-3">
              <MapPin className="size-3.5" strokeWidth={1.5} /> {person.city}
            </p>
          ) : null}
        </div>
      </div>
      {line ? (
        <p
          key={line}
          className="max-w-2xl animate-settle-in font-title text-[1.75rem] leading-[1.15] md:text-[2.25rem]"
        >
          {line}
        </p>
      ) : live ? (
        <p className="flex items-center gap-2.5 font-title text-[1.75rem] text-text-3">
          <span className="size-2 animate-signal-pulse rounded-full bg-signal" /> {t("computing")}
        </p>
      ) : null}
      <LovesRow loves={loves} />
    </section>
  )
}

/** The families of Qloo's words, in one voice: a quiet label, then the words as chips. */
const FAMILIES = ["aesthetic", "decor", "ambience", "style", "cuisine", "lifestyle"] as const

export function WordPalette({
  words,
  labels,
}: {
  words: TasteWords
  labels: Record<string, string>
}) {
  return (
    <dl className="flex flex-col gap-4">
      {FAMILIES.filter((f) => words[f]?.length).map((f, row) => (
        <div
          key={f}
          className="flex animate-settle-in flex-col gap-2"
          style={{ "--enter-delay": `${row * 50}ms` } as React.CSSProperties}
        >
          <dt className="text-[11px] font-medium tracking-[0.08em] text-text-3 uppercase">
            {labels[f]}
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            {words[f].slice(0, 6).map((w) => (
              <span
                key={w}
                className="rounded-tag bg-raised px-2.5 py-1 text-[13px] text-text-2 shadow-sticker"
              >
                {w}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}
