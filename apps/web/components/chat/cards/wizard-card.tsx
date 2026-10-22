"use client"

import type { NajimiTools } from "@najimi/agent"
import { Button } from "@najimi/ui/components/button"
import { cn } from "@najimi/ui/lib/utils"
import { Check } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

type Input = NajimiTools["askUser"]["input"]
type Output = NajimiTools["askUser"]["output"]

/**
 * The question wizard (C3): one question at a time, a count, back and skip; the answers go back
 * as the tool's output and the card folds into a summary of what was chosen.
 */
export function WizardCard({
  input,
  output,
  onAnswer,
}: {
  input: Input
  output?: Output
  onAnswer?: (output: Output) => void
}) {
  const t = useTranslations("Wizard")
  const [step, setStep] = useState(0)
  const [chosen, setChosen] = useState<Record<string, string[]>>({})
  const [other, setOther] = useState<Record<string, string>>({})

  if (output || !onAnswer) {
    const answers = output?.answers ?? []
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-text-3">{input.title}:</span>
        {output?.skipped || !answers.length ? (
          <span className="rounded-pill bg-secondary px-2.5 py-1 text-xs">{t("skipped")}</span>
        ) : (
          answers.flatMap((a) =>
            [...a.choices, ...(a.other ? [a.other] : [])].map((c) => (
              <span key={`${a.stepId}-${c}`} className="sticker px-2.5 py-1 text-xs font-semibold">
                {c}
              </span>
            )),
          )
        )}
      </div>
    )
  }

  const current = input.steps[step]
  if (!current) return null
  const picked = chosen[current.id] ?? []
  const last = step === input.steps.length - 1

  const toggle = (label: string) =>
    setChosen((c) => {
      const now = c[current.id] ?? []
      if (current.multi)
        return {
          ...c,
          [current.id]: now.includes(label) ? now.filter((x) => x !== label) : [...now, label],
        }
      return { ...c, [current.id]: [label] }
    })

  const finish = () =>
    onAnswer({
      answers: input.steps.map((s) => ({
        stepId: s.id,
        question: s.question,
        choices: chosen[s.id] ?? [],
        ...(other[s.id]?.trim() ? { other: other[s.id]?.trim() } : {}),
      })),
    })

  return (
    <section className="flex animate-card-land flex-col gap-4 rounded-card bg-card p-4 text-card-foreground shadow-paper">
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-[17px] leading-snug">{input.title}</h3>
        <span className="sticker px-2.5 py-0.5 text-[11px] font-semibold tnum">
          {t("count", { current: step + 1, total: input.steps.length })}
        </span>
      </header>
      <p className="font-semibold">{current.question}</p>
      <div className="flex flex-wrap gap-2">
        {current.options.map((o) => {
          const on = picked.includes(o.label)
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.label)}
              aria-pressed={on}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-sm font-semibold transition-colors",
                on
                  ? "border-transparent bg-lime text-lime-foreground"
                  : "border-paper-foreground/15 hover:border-paper-foreground/40",
              )}
            >
              {on ? <Check className="size-3.5" /> : null}
              {o.label}
            </button>
          )
        })}
      </div>
      <input
        value={other[current.id] ?? ""}
        onChange={(e) => setOther((x) => ({ ...x, [current.id]: e.target.value }))}
        placeholder={t("other")}
        maxLength={120}
        className="rounded-pill bg-paper px-4 py-2 text-sm ring-1 ring-paper-foreground/12 outline-none focus:ring-2 focus:ring-ring"
      />
      <footer className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-paper-foreground hover:bg-paper-foreground/8"
              onClick={() => setStep((s) => s - 1)}
            >
              {t("back")}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="text-paper-muted hover:bg-paper-foreground/8"
            onClick={() => onAnswer({ answers: [], skipped: true })}
          >
            {t("skip")}
          </Button>
        </div>
        <Button size="sm" onClick={() => (last ? finish() : setStep((s) => s + 1))}>
          {last ? t("done") : t("next")}
        </Button>
      </footer>
    </section>
  )
}
