"use client"

import { TASTE } from "@najimi/config"
import { Button } from "@najimi/ui/components/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@najimi/ui/components/sheet"
import { Slider } from "@najimi/ui/components/slider"
import { toast } from "@najimi/ui/components/sonner"
import { Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Artwork, shapeOf } from "@/components/artwork"
import { LoveSearch } from "@/components/loves/love-search"
import { api } from "@/lib/fetcher"

export type EditableLove = {
  id: string
  qlooId: string
  type: string
  name: string
  imageUrl: string | null
  weight: number
}

/** Add, remove and reweight loves; every change recomputes the taste (the reveal watches the run). */
export function LovesEditor({
  personId,
  loves,
  onChanged,
}: {
  personId: string
  loves: EditableLove[]
  onChanged: (runId: string) => void
}) {
  const t = useTranslations("Loves")
  const [busy, setBusy] = useState(false)
  const picked = new Set(loves.map((l) => l.qlooId))

  async function run(path: string, init: { method?: string; json?: unknown }) {
    setBusy(true)
    try {
      const { runId } = await api<{ runId: string }>(path, init)
      onChanged(runId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="sticker" size="sm" />}>
        <Pencil /> {t("addLove")}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-0 bg-background sm:max-w-md"
      >
        <SheetTitle className="font-title px-5 pt-5 text-[1.75rem] font-normal">
          {t("addLove")}
        </SheetTitle>
        <div className="flex flex-col gap-5 px-5 pb-8" aria-busy={busy}>
          <LoveSearch
            picked={picked}
            onPick={(hit) =>
              run(`/api/people/${personId}/loves`, {
                json: {
                  qlooId: hit.qlooId,
                  type: hit.type,
                  name: hit.name,
                  image: hit.image,
                  weight: TASTE.weightDefault,
                },
              })
            }
          />
          <ul className="flex flex-col gap-2.5">
            {loves.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-3 rounded-card bg-card p-2.5 text-card-foreground shadow-paper"
              >
                <Artwork
                  src={l.imageUrl}
                  name={l.name}
                  shape={shapeOf(l.type)}
                  className="w-12 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="truncate text-sm font-semibold">{l.name}</span>
                  <Slider
                    defaultValue={[l.weight]}
                    min={TASTE.weightMin}
                    max={TASTE.weightMax}
                    step={1}
                    aria-label={t("weight")}
                    disabled={busy}
                    onValueCommitted={(v) => {
                      const weight = Array.isArray(v) ? v[0] : v
                      if (weight !== undefined && weight !== l.weight)
                        run(`/api/people/${personId}/loves/${l.id}`, {
                          method: "PATCH",
                          json: { weight },
                        })
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("remove", { name: l.name })}
                  disabled={busy || loves.length <= 1}
                  title={loves.length <= 1 ? t("keepOne") : undefined}
                  onClick={() => run(`/api/people/${personId}/loves/${l.id}`, { method: "DELETE" })}
                  className="text-paper-muted hover:bg-paper-foreground/8 hover:text-paper-foreground"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  )
}
