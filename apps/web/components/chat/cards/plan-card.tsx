"use client"

import type { NajimiTools } from "@najimi/agent"
import { cn } from "@najimi/ui/lib/utils"
import { CalendarPlus, Car, Footprints, MapPin, Ticket } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { OpenThing } from "@/components/entity/entity-provider"
import { Face } from "@/components/taste/face"

/*
 * A plan in the thread (W16, W17): the route on a map, then the stops in order — when, where,
 * why, and in a circle who each one suits — with shows that night and the calendar one tap away.
 * After Tripsy's itinerary (Refero 398c4935) and Uber's stops (a2107fdd).
 */

type Output = NajimiTools["planNight"]["output"]

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

/** A stop as something to open (a place in Qloo; hotels and shows have no id). */
const placeOf = (s: Output["stops"][number]) => ({
  qlooId: s.qlooId ?? null,
  type: "urn:entity:place",
  name: s.name,
  image: s.image,
  area: s.area,
})

export function PlanCard({ output }: { output: Output }) {
  const t = useTranslations("Plans")
  const [mapOk, setMapOk] = useState(true)
  if (!output.token || !output.stops.length)
    return (
      <p className="rounded-card bg-card px-4 py-3 text-sm text-text-2">
        {output.note ?? t("none")}
      </p>
    )
  const days = [...new Set(output.stops.map((s) => s.day))]
  return (
    <section className="dark flex flex-col overflow-hidden rounded-card bg-[#0b0b0d] text-foreground ring-1 ring-white/10">
      {mapOk ? (
        // biome-ignore lint/performance/noImgElement: the plan's route, drawn by Mapbox
        <img
          src={`/api/plans/${output.token}/map`}
          alt=""
          onError={() => setMapOk(false)}
          className="aspect-[16/9] w-full object-cover"
        />
      ) : null}
      <div className="flex flex-col gap-4 p-4">
        <header className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-[0.08em] text-signal uppercase">
            {output.kind === "night" ? t("night") : t("trip")}
          </span>
          <h3 className="font-title text-[22px] leading-tight">{output.title}</h3>
          {output.route ? (
            <span className="flex items-center gap-1.5 text-[13px] text-text-3">
              {output.route.profile === "walking" ? (
                <Footprints className="size-3.5" />
              ) : (
                <Car className="size-3.5" />
              )}
              {t("route", {
                stops: output.stops.length,
                minutes: output.route.minutes,
                km: output.route.km,
              })}
            </span>
          ) : null}
        </header>

        {days.map((day) => (
          <div key={day} className="flex flex-col gap-3">
            {days.length > 1 ? (
              <span className="text-[12px] font-bold text-text-3 uppercase">
                {t("day", { n: day })}
              </span>
            ) : null}
            <ol className="relative flex flex-col gap-3 ps-5 before:absolute before:inset-y-2 before:start-[7px] before:w-px before:bg-white/15">
              {output.stops
                .filter((s) => s.day === day)
                .map((s) => (
                  <li key={`${s.day}-${s.slot}-${s.name}`} className="relative flex gap-3">
                    <span className="absolute -start-5 top-1.5 size-3.5 rounded-full border-2 border-[#0b0b0d] bg-signal" />
                    {s.image ? (
                      <OpenThing thing={placeOf(s)} className="shrink-0 rounded-tile">
                        {/* biome-ignore lint/performance/noImgElement: remote artwork */}
                        <img
                          src={sized(s.image, 240) ?? ""}
                          alt=""
                          className="size-16 rounded-tile object-cover"
                        />
                      </OpenThing>
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[12px] font-semibold text-text-3">
                        {s.at ? `${s.at} · ` : ""}
                        {t(`slots.${s.slot}` as "slots.drinks")}
                      </span>
                      <OpenThing thing={placeOf(s)} chevron className="max-w-full">
                        <span className="truncate text-[15px] font-semibold">{s.name}</span>
                      </OpenThing>
                      {s.area ? (
                        <span className="flex items-center gap-1 truncate text-[12px] text-text-3">
                          <MapPin className="size-3 shrink-0" /> {s.area}
                        </span>
                      ) : null}
                      {s.why ? <span className="text-[13px] text-text-2">{s.why}</span> : null}
                      {s.fits.length ? (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {s.fits.map((f) => (
                            <span
                              key={f.name}
                              className="inline-flex items-center gap-1 rounded-pill bg-white/8 py-0.5 ps-0.5 pe-2 text-[11px] font-semibold"
                            >
                              <Face look={f.look} name={f.name} size="xs" />
                              {f.fit != null ? `${Math.round(f.fit * 100)}%` : "—"}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ol>
          </div>
        ))}

        {output.shows.length ? (
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold text-text-3 uppercase">{t("shows")}</span>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
              {output.shows.map((sh) => (
                <a
                  key={sh.url}
                  href={sh.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-44 shrink-0 flex-col overflow-hidden rounded-tile bg-white/5"
                >
                  {sh.image ? (
                    // biome-ignore lint/performance/noImgElement: the show's own image
                    <img src={sh.image} alt="" className="aspect-[16/9] w-full object-cover" />
                  ) : null}
                  <span className="flex flex-col gap-0.5 p-2">
                    <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
                      {sh.name}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-text-3">
                      <Ticket className="size-3" />{" "}
                      {[sh.localTime, sh.venue].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/plan/${output.token}`}
            className="flex h-11 items-center justify-center rounded-pill bg-foreground text-[14px] font-semibold text-background"
          >
            {t("open")}
          </Link>
          <a
            href={`/api/plans/${output.token}/ics`}
            className={cn(
              "glass flex h-11 items-center justify-center gap-2 rounded-pill text-[14px] font-semibold",
            )}
          >
            <CalendarPlus className="size-4" /> {t("calendar")}
          </a>
        </div>
      </div>
    </section>
  )
}
