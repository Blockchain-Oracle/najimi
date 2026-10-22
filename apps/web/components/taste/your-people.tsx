"use client"

import type { TasteArea } from "@najimi/db/schema"
import { MapPin } from "lucide-react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"

/*
 * Where your people are: the strongest areas of your city on Qloo's heatmap for your taste, each
 * named by the places inside it that fit you. The first is the pin on your taste card; the whole
 * map (the Earth) builds on it.
 */
export function YourPeople({ city, areas }: { city: string; areas: TasteArea[] }) {
  const t = useTranslations("Taste")
  const [top, ...rest] = areas
  if (!top) return null
  return (
    <section className="flex flex-col gap-4 rounded-card bg-card p-5">
      <p className="text-[13px] text-text-3">{t("peopleIn", { city })}</p>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <MapPin className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-title text-[1.75rem] leading-tight">{top.name}</h2>
          {top.places.length ? (
            <p className="text-sm text-text-2">
              {t("knownFor", { places: top.places.slice(0, 3).join(", ") })}
            </p>
          ) : null}
        </div>
      </motion.div>
      {rest.length ? (
        <ul className="flex flex-wrap gap-2">
          {rest.map((a) => (
            <li
              key={a.name}
              className="inline-flex items-center gap-1.5 rounded-pill bg-background px-3 py-1.5 text-sm"
            >
              <MapPin className="size-3.5 text-text-3" /> {a.name}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
