"use client"

import type { NajimiTools } from "@najimi/agent"
import { cn } from "@najimi/ui/lib/utils"
import { MapPin } from "lucide-react"
import { useTranslations } from "next-intl"
import { Face } from "@/components/taste/face"

/*
 * Something for everyone in the circle: each pick with each member's own fit (Qloo scored the
 * shortlist against every taste), so the room sees at a glance who it's for. After Genie's place
 * cards in a group thread (Refero fa455185) with Airbuds' faces-and-score (1904948a).
 */

const sized = (url: string | null, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : url

export function GroupFitCard({ output }: { output: NajimiTools["groupFit"]["output"] }) {
  const t = useTranslations("Cards")
  const looks = new Map(output.members.map((m) => [m.name, m.look]))
  if (!output.picks.length)
    return <p className="rounded-card bg-card px-4 py-3 text-sm text-text-2">{output.note}</p>
  return (
    <section className="flex flex-col gap-3 rounded-card bg-card p-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-[16px]">{output.title}</h3>
        <span className="flex -space-x-2">
          {output.members.map((m) => (
            <span key={m.name} className="rounded-full ring-2 ring-card">
              <Face look={m.look} name={m.name} size="xs" />
            </span>
          ))}
        </span>
      </header>
      <ol className="flex flex-col gap-3">
        {output.picks.map((p, i) => {
          const best = Math.max(...p.fits.map((f) => f.fit ?? 0))
          return (
            <li key={p.qlooId} className="flex gap-3">
              <span className="relative shrink-0">
                {p.image ? (
                  // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
                  <img
                    src={sized(p.image, 240) ?? p.image}
                    alt=""
                    className="size-16 rounded-tile object-cover"
                  />
                ) : (
                  <span className="grid size-16 place-items-center rounded-tile bg-secondary text-[12px] font-semibold">
                    {p.name.slice(0, 2)}
                  </span>
                )}
                <span className="absolute -top-1.5 -start-1.5 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-semibold">{p.name}</span>
                  {p.area || p.caption ? (
                    <span className="flex items-center gap-1 truncate text-[12px] text-text-3">
                      {p.area ? <MapPin className="size-3 shrink-0" /> : null}
                      {p.area ?? p.caption}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.fits.map((f) => (
                    <span
                      key={f.name}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-pill py-0.5 ps-0.5 pe-2 text-[11px] font-semibold",
                        f.fit != null && f.fit === best
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary",
                      )}
                      title={t("fitFor", { name: f.name })}
                    >
                      <Face look={looks.get(f.name) ?? null} name={f.name} size="xs" />
                      {f.fit != null ? `${Math.round(f.fit * 100)}%` : "—"}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
