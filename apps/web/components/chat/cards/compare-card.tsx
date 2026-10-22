"use client"

import type { NajimiTools } from "@najimi/agent"
import { useTranslations } from "next-intl"
import { CardShell } from "./insights-card"

type Output = NajimiTools["qlooCompare"]["output"]

/** Two tastes side by side (Qloo analysis/compare): what they share, scored, and what's only theirs. */
export function CompareCard({ output }: { output: Output }) {
  const t = useTranslations("Cards")
  const max = Math.max(...output.shared.map((s) => s.score ?? 0), 0.01)
  return (
    <CardShell title={output.title} callId={output.callId}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
            {t("only", { name: output.a })}
          </p>
          <ul className="flex flex-wrap gap-1">
            {output.onlyA.map((n) => (
              <li
                key={n}
                className="rounded-tag bg-raised px-2 py-0.5 text-xs text-text-2 shadow-sticker"
              >
                {n}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
            {t("shared")}
          </p>
          <ul className="flex flex-col gap-1">
            {output.shared.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-xs">
                <span className="w-28 truncate font-semibold">{s.name}</span>
                <span className="h-1.5 flex-1 rounded-full bg-paper-foreground/8">
                  <span
                    className="block h-full rounded-full bg-lime-ink"
                    style={{ width: `${((s.score ?? 0) / max) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
            {t("only", { name: output.b })}
          </p>
          <ul className="flex flex-wrap gap-1">
            {output.onlyB.map((n) => (
              <li
                key={n}
                className="rounded-tag bg-raised px-2 py-0.5 text-xs text-text-2 shadow-sticker"
              >
                {n}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CardShell>
  )
}
