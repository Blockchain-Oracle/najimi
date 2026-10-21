"use client"

import type { NajimiTools } from "@najimi/agent"
import { ExternalLink, Pill } from "lucide-react"
import { useTranslations } from "next-intl"
import { CardShell } from "./insights-card"

type Output = NajimiTools["medicationNotes"]["output"]

const date = (yyyymmdd: string | null) =>
  yyyymmdd ? `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}` : ""

/** What the FDA label says about food and drink (rule 11): quoted, cited, never advice. */
export function MedicationCard({ output }: { output: Output }) {
  const t = useTranslations("Food")
  return (
    <CardShell title={t("medsTitle", { name: output.personName })} callId={null}>
      {output.notes.map((n) => (
        <section key={n.medication} className="flex flex-col gap-1.5">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Pill className="size-4" /> {n.medication}
            {n.brand ? <span className="font-normal text-paper-muted">({n.brand})</span> : null}
            {n.url ? (
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-normal text-paper-muted underline"
              >
                {t("label", { date: date(n.effective) })} <ExternalLink className="size-3" />
              </a>
            ) : null}
          </p>
          {!n.found ? (
            <p className="text-sm text-paper-muted">{t("noLabel")}</p>
          ) : n.excerpts.length ? (
            <ul className="flex flex-col gap-1">
              {n.excerpts.map((e) => (
                <li key={e.text} className="border-s-2 border-lime-ink ps-3 text-sm">
                  “{e.text}” <span className="text-xs text-paper-muted">— {e.section}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-paper-muted">{t("noFoodNotes")}</p>
          )}
        </section>
      ))}
      <p className="rounded-tile bg-paper-foreground/5 p-3 text-xs">{t("pharmacist")}</p>
    </CardShell>
  )
}
