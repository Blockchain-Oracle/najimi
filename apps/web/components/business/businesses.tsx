"use client"

import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { ArrowRight, Loader2, Plus, Store } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { sized } from "@/components/connect/platforms"
import type { BusinessView } from "@/lib/business"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"

/*
 * Business mode's front door: your businesses (each a plan), and a new one in a single sheet —
 * what it is, its name, where, and if you like the site, who you think comes, what you're deciding.
 */

const KINDS = ["café", "restaurant", "bar", "salon", "shop", "studio", "electrician"] as const

function NewPlan({ city, onClose }: { city: string | null; onClose: () => void }) {
  const t = useTranslations("Business")
  const router = useRouter()
  const [f, setF] = useState<Record<string, string>>({ city: city ?? "" })
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }))
  const ready = f.name?.trim() && f.kind?.trim() && f.city?.trim()
  const field =
    "h-12 w-full rounded-tile bg-card px-4 text-[16px] outline-none ring-1 ring-border placeholder:text-text-3 focus:ring-2 focus:ring-ring"

  const submit = async () => {
    setBusy(true)
    try {
      const site = f.site?.trim()
      const r = await api<{ id: string }>("/api/businesses", {
        json: {
          name: f.name,
          kind: f.kind,
          city: f.city,
          address: f.address || undefined,
          site: site && !site.startsWith("@") ? site : undefined,
          instagram: site?.startsWith("@") ? site : undefined,
          audience: f.audience || undefined,
          decision: f.decision || undefined,
        },
      })
      sound("promote")
      onClose()
      router.push(`/business/${r.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("failed"))
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4 pt-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) void submit()
      }}
    >
      <SheetTitle className="font-title text-[1.6rem] font-normal">{t("newTitle")}</SheetTitle>
      <div className="flex flex-col gap-2">
        <input
          className={field}
          placeholder={t("fieldName")}
          value={f.name ?? ""}
          onChange={set("name")}
        />
        <input
          className={field}
          placeholder={t("fieldKind")}
          value={f.kind ?? ""}
          onChange={set("kind")}
        />
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setF((x) => ({ ...x, kind: k }))}
              className={cn(
                "rounded-pill px-3 py-1.5 text-[13px] font-semibold ring-1 transition-colors",
                f.kind === k
                  ? "bg-foreground text-background ring-foreground"
                  : "bg-card ring-border",
              )}
            >
              {t(`kinds.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          className={field}
          placeholder={t("fieldCity")}
          value={f.city ?? ""}
          onChange={set("city")}
        />
        <input
          className={field}
          placeholder={t("fieldArea")}
          value={f.address ?? ""}
          onChange={set("address")}
        />
      </div>
      <input
        className={field}
        placeholder={t("fieldSite")}
        autoCapitalize="none"
        value={f.site ?? ""}
        onChange={set("site")}
      />
      <input
        className={field}
        placeholder={t("fieldAudience")}
        value={f.audience ?? ""}
        onChange={set("audience")}
      />
      <input
        className={field}
        placeholder={t("fieldDecision")}
        value={f.decision ?? ""}
        onChange={set("decision")}
      />
      <button
        type="submit"
        disabled={!ready || busy}
        className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
        {t("build")}
      </button>
    </form>
  )
}

export function Businesses({ list, city }: { list: BusinessView[]; city: string | null }) {
  const t = useTranslations("Business")
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <h1 className="font-title text-[2rem] leading-none">{t("title")}</h1>
        {list.length ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-10 items-center gap-1.5 rounded-pill bg-foreground px-4 text-[14px] font-semibold text-background"
          >
            <Plus className="size-4" /> {t("new")}
          </button>
        ) : null}
      </header>

      {list.length ? (
        <ul className="flex flex-col gap-3">
          {list.map((b) => {
            const fans = Object.values(b.report?.fans ?? {})
              .flat()
              .filter((x) => x.image)
              .slice(0, 5)
            return (
              <li key={b.id}>
                <Link
                  href={`/business/${b.id}`}
                  className="flex items-center gap-4 rounded-card bg-card p-4 ring-1 ring-border transition-colors hover:bg-secondary"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-tile bg-signal/12 text-signal">
                    <Store className="size-6" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-heading text-[17px]">{b.name}</span>
                    <span className="truncate text-[13px] text-text-3">
                      {b.status === "ready"
                        ? [b.kind, b.report?.areas[0]?.name].filter(Boolean).join(" · ")
                        : b.status === "building"
                          ? t("buildingShort")
                          : t("failedShort")}
                    </span>
                  </span>
                  <span className="flex -space-x-2">
                    {fans.map((x) => (
                      // biome-ignore lint/performance/noImgElement: remote artwork
                      <img
                        key={x.qlooId}
                        src={sized(x.image, 64) ?? ""}
                        alt=""
                        className="size-8 rounded-full object-cover ring-2 ring-card"
                      />
                    ))}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <section className="dark relative isolate flex flex-col gap-4 overflow-hidden rounded-sheet bg-[#0b0b0d] p-6 text-foreground ring-1 ring-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, #FF4FA3 0%, transparent 70%)" }}
          />
          <Store className="size-8 text-signal" />
          <h2 className="font-title text-[1.8rem] leading-tight">{t("emptyTitle")}</h2>
          <p className="text-[15px] text-text-2">{t("emptyLine")}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-12 items-center justify-center gap-2 self-start rounded-pill bg-foreground px-5 font-heading text-[15px] text-background"
          >
            {t("start")} <ArrowRight className="size-4" />
          </button>
        </section>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          {open ? <NewPlan city={city} onClose={() => setOpen(false)} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
