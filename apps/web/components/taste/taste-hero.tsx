"use client"

import type { TasteWords } from "@najimi/db/schema"
import { Orb } from "@najimi/ui/components/orb"
import { MapPin } from "lucide-react"
import { useTranslations } from "next-intl"
import { Face } from "./face"
import { type CardLove, LovesRow } from "./taste-card"

/*
 * The top of a taste page: their face on their aura (an orb lit in the colours of what they love,
 * with a wash of the same colours behind), their name, and their taste read aloud in one line of
 * Qloo's own words ("Minimalist looks, homey rooms, warm nights, Caribbean plates."), then the
 * loves it came from, in a row.
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
  aura,
  words,
  loves,
  live,
}: {
  person: { name: string; isSelf: boolean; city: string | null; username?: string | null }
  look: string | null
  aura: { c1: string; c2: string; c3: string } | null
  words: TasteWords | null
  loves: CardLove[]
  live: boolean
}) {
  const t = useTranslations("Taste")
  const line = useTasteLine(words)
  return (
    <section className="relative flex flex-col gap-6">
      {/* A wash of their colours behind the top of the page. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-16 -z-10 h-72 opacity-40 blur-3xl transition-[background] duration-700 dark:opacity-30"
        style={{
          background: `radial-gradient(60% 70% at 15% 30%, ${aura?.c1 ?? "var(--color-aura-1)"}, transparent 70%), radial-gradient(50% 60% at 55% 20%, ${aura?.c2 ?? "var(--color-aura-2)"}, transparent 70%), radial-gradient(45% 55% at 85% 40%, ${aura?.c3 ?? "var(--color-aura-3)"}, transparent 70%)`,
        }}
      />
      <div className="flex items-center gap-5">
        {/* Their face on their aura: the orb glows as a ring around it. */}
        <span className="relative grid size-32 shrink-0 place-items-center">
          <Orb size={128} colors={aura ?? undefined} working={live} className="absolute inset-0" />
          <span className="relative">
            <Face look={look} name={person.name} size="xl" />
          </span>
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[13px] text-text-3">
            {person.isSelf ? t("mine") : t("theirs", { name: person.name })}
          </p>
          <h1 className="truncate font-title text-[2.5rem] leading-none md:text-5xl">
            {person.name}
          </h1>
          {person.username || person.city ? (
            <p className="flex items-center gap-3 text-sm text-text-3">
              {person.username ? (
                <span className="font-semibold text-text-2">@{person.username}</span>
              ) : null}
              {person.city ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" strokeWidth={1.8} /> {person.city}
                </span>
              ) : null}
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
