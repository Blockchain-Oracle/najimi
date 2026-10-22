"use client"

import type { BusinessIdea, BusinessReport, BusinessThing } from "@najimi/db/schema"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import {
  Copy,
  Handshake,
  Moon,
  Music,
  Package,
  Sofa,
  TrendingUp,
  UtensilsCrossed,
  Wrench,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { siX } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { sized } from "@/components/connect/platforms"

/*
 * A business's plan (W19), from Qloo evidence only. The city with its people rising out of it,
 * stats floating over it (Shopify's location analytics, Refero e52ed0dd); Najimi's read in two or
 * three sentences; the ideas, each showing the things it stands on; what the fans love; the
 * business against its own street; what's rising; partners; posts. Shared as is.
 */

const BusinessMap = dynamic(() => import("./business-map").then((m) => m.BusinessMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-white/5" />,
})

const KIND_ICON: Record<BusinessIdea["kind"], typeof Music> = {
  menu: UtensilsCrossed,
  music: Music,
  night: Moon,
  stock: Package,
  partner: Handshake,
  space: Sofa,
  service: Wrench,
}
const KINDS = [
  ["urn:entity:artist", "music"],
  ["urn:entity:movie", "film"],
  ["urn:entity:tv_show", "tv"],
  ["urn:entity:book", "books"],
  ["urn:entity:podcast", "podcasts"],
  ["urn:entity:brand", "brands"],
  ["urn:entity:place", "places"],
] as const

export type PlanBusiness = {
  name: string
  kind: string
  city: string | null
  lat: number | null
  lon: number | null
  report: BusinessReport
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-[18px]">{title}</h2>
      {children}
    </section>
  )
}

function Art({ thing, size = 40 }: { thing: BusinessThing; size?: number }) {
  return thing.image ? (
    // biome-ignore lint/performance/noImgElement: remote artwork
    <img
      src={sized(thing.image, size * 2) ?? ""}
      alt={thing.name}
      title={thing.name}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover ring-2 ring-background"
    />
  ) : (
    <span
      title={thing.name}
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold ring-2 ring-background"
    >
      {thing.name.slice(0, 1)}
    </span>
  )
}

/** The lean as a few readable words: the age band most over-represented, and gender. */
function leanWords(lean: BusinessReport["lean"]) {
  if (!lean) return null
  const age = Object.entries(lean.age).sort((a, b) => b[1] - a[1])[0]
  const gender = Object.entries(lean.gender).sort((a, b) => b[1] - a[1])[0]
  const band = age?.[0]
    .replace("_to_", "–")
    .replace("24_and_younger", "under 25")
    .replace("55_and_older", "55+")
  return { band: band ?? null, gender: gender && gender[1] > 0.15 ? gender[0] : null }
}

export function PlanView({ business, actions }: { business: PlanBusiness; actions?: ReactNode }) {
  const t = useTranslations("Business")
  const r = business.report
  const all = new Map<string, BusinessThing>()
  for (const list of [
    ...Object.values(r.fans),
    r.comparables,
    r.match ? [r.match] : [],
    r.scene?.artists ?? [],
    r.scene?.brands ?? [],
    r.scene?.places ?? [],
    r.rising,
  ])
    for (const i of list) all.set(i.qlooId, i)
  const kinds = KINDS.filter(([type]) => r.fans[type]?.length)
  const [kind, setKind] = useState<string>(kinds[0]?.[0] ?? "")
  const lean = leanWords(r.lean)
  const centre =
    business.lat != null && business.lon != null ? { lat: business.lat, lon: business.lon } : null

  return (
    <article className="flex flex-col gap-8">
      <div className="dark relative -mx-5 overflow-hidden text-foreground md:mx-0 md:rounded-sheet">
        <BusinessMap
          name={business.name}
          centre={centre}
          cells={r.cells}
          areas={r.areas.slice(0, 4)}
          className="h-[52svh] min-h-[340px] w-full bg-[#07060c]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        {actions ? <div className="absolute top-3 end-3 flex gap-2">{actions}</div> : null}
        <div className="absolute inset-x-3 bottom-3 grid grid-cols-3 gap-2">
          {[
            { k: t("statWhere"), v: r.areas[0]?.name ?? "—" },
            {
              k: t("statWho"),
              v: lean?.band
                ? `${lean.band}${lean.gender ? ` · ${t(`gender.${lean.gender}` as "gender.male")}` : ""}`
                : "—",
            },
            { k: t("statRising"), v: r.rising.length ? String(r.rising.length) : "—" },
          ].map((s) => (
            <div
              key={s.k}
              className="flex min-w-0 flex-col gap-0.5 rounded-tile bg-black/55 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-md"
            >
              <span className="truncate text-[11px] font-semibold text-white/60">{s.k}</span>
              <span className="truncate font-heading text-[15px] text-white">{s.v}</span>
            </div>
          ))}
        </div>
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-title text-[2.4rem] leading-none">{business.name}</h1>
          <span className="text-[14px] text-text-3">
            {[business.kind, business.city].filter(Boolean).join(" · ")}
          </span>
        </div>
        {r.plan?.summary ? (
          <p className="text-[17px] leading-relaxed text-text-2">{r.plan.summary}</p>
        ) : null}
        {r.words.length ? (
          <div className="flex flex-wrap gap-1.5">
            {r.words.slice(0, 8).map((w) => (
              <span
                key={w.name}
                className="rounded-pill bg-card px-2.5 py-1 text-[12px] font-semibold text-text-2 ring-1 ring-border"
              >
                {w.name}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {r.plan?.ideas.length ? (
        <Section title={t("ideas")}>
          <ul className="flex flex-col gap-3">
            {r.plan.ideas.map((idea) => {
              const Icon = KIND_ICON[idea.kind]
              const evidence = idea.evidence.flatMap((id) => {
                const found = all.get(id)
                return found ? [found] : []
              })
              return (
                <li
                  key={idea.title}
                  className="flex flex-col gap-3 rounded-card bg-card p-4 ring-1 ring-border"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-signal/12 text-signal">
                      <Icon className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <h3 className="font-heading text-[16px] leading-snug">{idea.title}</h3>
                      <p className="text-[14px] leading-relaxed text-text-2">{idea.why}</p>
                    </div>
                  </div>
                  {evidence.length ? (
                    <div className="flex items-center gap-2 border-t border-border pt-3">
                      <span className="flex -space-x-2">
                        {evidence.map((e) => (
                          <Art key={e.qlooId} thing={e} size={28} />
                        ))}
                      </span>
                      <span className="truncate text-[12px] text-text-3">
                        {evidence.map((e) => e.name).join(" · ")}
                      </span>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </Section>
      ) : null}

      {kinds.length ? (
        <Section title={t("fansLove")}>
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
            {kinds.map(([type, key]) => (
              <button
                key={type}
                type="button"
                aria-pressed={kind === type}
                onClick={() => setKind(type)}
                className={cn(
                  "h-9 shrink-0 rounded-pill px-3.5 text-[13px] font-semibold transition-colors",
                  kind === type
                    ? "bg-foreground text-background"
                    : "bg-card text-text-2 ring-1 ring-border",
                )}
              >
                {t(`kind.${key}`)}
              </button>
            ))}
          </div>
          <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
            {(r.fans[kind] ?? []).map((item) => (
              <li key={item.qlooId} className="flex w-32 shrink-0 snap-start flex-col gap-1.5">
                {item.image ? (
                  // biome-ignore lint/performance/noImgElement: remote artwork
                  <img
                    src={sized(item.image, 320) ?? ""}
                    alt=""
                    className="aspect-square w-full rounded-tile object-cover"
                  />
                ) : (
                  <span className="aspect-square w-full rounded-tile bg-secondary" />
                )}
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
                  {item.name}
                </span>
                {item.caption ? (
                  <span className="truncate text-[11px] text-text-3">{item.caption}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {r.compare ? (
        <Section title={t("street", { area: r.scene?.area ?? business.city ?? "" })}>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { k: t("onlyFans"), list: r.compare.theirsOnly, tone: "bg-signal/12 text-signal" },
              { k: t("both"), list: r.compare.shared, tone: "bg-white/10 text-foreground" },
              {
                k: t("onlyStreet"),
                list: r.compare.sceneOnly,
                tone: "bg-card text-text-3 ring-1 ring-border",
              },
            ].map((col) => (
              <div key={col.k} className="flex flex-col gap-2">
                <span className="text-[12px] font-bold tracking-[0.06em] text-text-3 uppercase">
                  {col.k}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(col.list)].slice(0, 6).map((w) => (
                    <span
                      key={w}
                      className={cn("rounded-pill px-2.5 py-1 text-[12px] font-semibold", col.tone)}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {r.scene?.places.length ? (
            <div className="flex items-center gap-2">
              <span className="flex -space-x-2">
                {r.scene.places.slice(0, 5).map((p) => (
                  <Art key={p.qlooId} thing={p} size={28} />
                ))}
              </span>
              <span className="truncate text-[12px] text-text-3">
                {t("streetPlaces", {
                  names: r.scene.places
                    .slice(0, 3)
                    .map((p) => p.name)
                    .join(", "),
                })}
              </span>
            </div>
          ) : null}
        </Section>
      ) : null}

      {r.rising.length ? (
        <Section title={t("rising")}>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card bg-card ring-1 ring-border">
            {r.rising.map((p) => (
              <li key={p.qlooId} className="flex items-center gap-3 px-4 py-3">
                <Art thing={p} size={36} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  {p.caption ? (
                    <span className="truncate text-[12px] text-text-3">{p.caption}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1 text-[13px] font-bold text-success tabular-nums">
                  <TrendingUp className="size-4" />+{p.growth.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {r.plan?.partners.length ? (
        <Section title={t("partners")}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {r.plan.partners.map((p) => {
              const found = all.get(p.qlooId)
              if (!found) return null
              return (
                <li
                  key={p.qlooId}
                  className="flex gap-3 rounded-card bg-card p-3.5 ring-1 ring-border"
                >
                  <Art thing={found} size={44} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-heading text-[15px]">{found.name}</span>
                    <span className="text-[13px] leading-snug text-text-2">{p.why}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </Section>
      ) : null}

      {r.plan?.posts.length ? (
        <Section title={t("posts")}>
          <ul className="flex flex-col gap-3">
            {r.plan.posts.map((post) => (
              <li
                key={post}
                className="flex flex-col gap-3 rounded-card bg-card p-4 ring-1 ring-border"
              >
                <p className="text-[15px] leading-relaxed">{post}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(post).catch(() => undefined)
                      toast(t("copied"))
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-pill bg-white/8 px-3.5 text-[13px] font-semibold"
                  >
                    <Copy className="size-3.5" /> {t("copy")}
                  </button>
                  <a
                    href={`https://x.com/intent/post?text=${encodeURIComponent(post)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 items-center gap-1.5 rounded-pill bg-foreground px-3.5 text-[13px] font-semibold text-background"
                  >
                    <BrandIcon icon={siX} className="size-3" /> {t("postOnX")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <footer className="flex items-center justify-between border-t border-border pt-4 text-[12px] text-text-3">
        <span>{t("builtOn", { count: r.calls.length })}</span>
        <time dateTime={r.builtAt} suppressHydrationWarning>
          {new Date(r.builtAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </time>
      </footer>
    </article>
  )
}
