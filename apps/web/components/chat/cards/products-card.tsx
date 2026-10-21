"use client"

import type { NajimiTools } from "@najimi/agent"
import { ExternalLink } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Artwork } from "@/components/artwork"
import { CardShell } from "./insights-card"

type Output = NajimiTools["findProducts"]["output"]

/** Get the look (T13): real products from each brand's own site, or the brand itself when none parse. */
export function ProductsCard({ output }: { output: Output }) {
  const t = useTranslations("Home")
  const locale = useLocale()
  const money = (price: number, currency: string | null) =>
    currency
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(price)
      : String(price)
  return (
    <CardShell title={output.title} callId={null}>
      <p className="text-sm text-paper-muted">{t("lookHint", { category: output.category })}</p>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {output.brands.flatMap((b) =>
          b.products.length
            ? b.products.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-44 shrink-0 snap-start flex-col gap-2 rounded-card border border-paper-foreground/10 p-2 transition-transform hover:-translate-y-0.5"
                >
                  {p.image ? (
                    // biome-ignore lint/performance/noImgElement: product photos come from each brand's own site
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="aspect-square w-full rounded-tile bg-white object-contain"
                    />
                  ) : (
                    <Artwork src={b.image} name={b.name} />
                  )}
                  <span className="px-1 text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
                    {b.name}
                  </span>
                  <span className="line-clamp-2 px-1 text-sm leading-tight font-semibold">
                    {p.name}
                  </span>
                  <span className="mt-auto flex items-center justify-between px-1 pb-1">
                    {p.price != null ? (
                      <span className="rounded-pill bg-lime px-2 py-0.5 text-xs font-bold text-lime-foreground tnum">
                        {money(p.price, p.currency)}
                      </span>
                    ) : (
                      <span />
                    )}
                    <ExternalLink className="size-3.5 text-paper-muted" />
                  </span>
                </a>
              ))
            : [
                <a
                  key={b.id}
                  href={b.site ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-44 shrink-0 snap-start flex-col gap-2 rounded-card border border-dashed border-paper-foreground/20 p-2"
                >
                  <Artwork src={b.image} name={b.name} />
                  <span className="px-1 text-sm font-semibold">{b.name}</span>
                  <span className="px-1 pb-1 text-xs text-paper-muted">{t("brandOnly")}</span>
                </a>,
              ],
        )}
      </div>
    </CardShell>
  )
}
