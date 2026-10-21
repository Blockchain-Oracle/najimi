"use client"

import type { NajimiTools } from "@najimi/agent"
import { Button } from "@najimi/ui/components/button"
import { Dialog, DialogContent, DialogTitle } from "@najimi/ui/components/dialog"
import { ChefHat, Clock, Minus, Plus, Thermometer, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { WithPerson } from "../chat-context"
import { CardShell } from "./insights-card"

type Recipe = NajimiTools["recipe"]["input"]

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 1 : 0))

/** A recipe (T14, brief #2): scaled to servings, texture and temperature for the person, then cook mode. */
export function RecipeCard({
  recipe,
  personName,
  constraints,
  onAsk,
}: {
  recipe: Recipe
  personName: string
  constraints: string[]
  onAsk: (text: string) => void
}) {
  const t = useTranslations("Food")
  const [servings, setServings] = useState(recipe.servings)
  const [cooking, setCooking] = useState<number | null>(null)
  const scale = servings / recipe.servings
  return (
    <CardShell title={recipe.title} callId={null}>
      <p className="text-sm">{recipe.blurb}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-pill bg-paper-foreground/6 px-2.5 py-1">
          <Clock className="size-3.5" /> {t("minutes", { n: recipe.minutes })}
        </span>
        <span className="inline-flex items-center gap-1 rounded-pill bg-paper-foreground/6 px-2.5 py-1">
          <Thermometer className="size-3.5" /> {t(`serve.${recipe.serve}`)}
        </span>
        {recipe.texture.iddsi ? (
          <span className="rounded-pill bg-lime px-2.5 py-1 font-semibold text-lime-foreground">
            IDDSI {recipe.texture.iddsi}
          </span>
        ) : null}
        {constraints.map((c) => (
          <span key={c} className="rounded-pill border border-paper-foreground/15 px-2.5 py-1">
            {c}
          </span>
        ))}
        <span className="text-paper-muted">
          <WithPerson text={(name) => t("forName", { name })} name={personName} />
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.3fr]">
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
              {t("ingredients")}
            </h4>
            <span className="inline-flex items-center gap-1 text-xs">
              <button
                type="button"
                aria-label={t("fewer")}
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="grid size-6 place-items-center rounded-full bg-paper-foreground/8"
              >
                <Minus className="size-3" />
              </button>
              <Users className="size-3.5" /> <span className="tnum">{servings}</span>
              <button
                type="button"
                aria-label={t("more")}
                onClick={() => setServings((s) => Math.min(24, s + 1))}
                className="grid size-6 place-items-center rounded-full bg-paper-foreground/8"
              >
                <Plus className="size-3" />
              </button>
            </span>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {recipe.ingredients.map((i) => (
              <li key={i.item} className="flex gap-2">
                <span className="w-20 shrink-0 text-paper-muted tnum">
                  {i.amount != null ? `${fmt(i.amount * scale)} ${i.unit}` : i.unit}
                </span>
                <span>
                  {i.item}
                  {i.note ? <span className="text-paper-muted"> — {i.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
            {t("method")}
          </h4>
          <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm">
            {recipe.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      </div>
      <p className="rounded-tile bg-paper-foreground/5 p-3 text-sm">
        <span className="font-semibold">{t("texture")}: </span>
        {recipe.texture.note}
      </p>
      {recipe.swaps.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {recipe.swaps.map((s) => (
            <li key={s.from}>
              <span className="font-semibold">
                {s.from} → {s.to}
              </span>{" "}
              <span className="text-paper-muted">— {s.why}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setCooking(0)}>
          <ChefHat /> {t("cookMode")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-paper-foreground hover:bg-paper-foreground/8"
          onClick={() => onAsk(t("photoAsk", { title: recipe.title }))}
        >
          {t("dishPhoto")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-paper-foreground hover:bg-paper-foreground/8"
          onClick={() => onAsk(t("weekAsk", { title: recipe.title }))}
        >
          {t("planWeek")}
        </Button>
      </div>
      <Dialog open={cooking !== null} onOpenChange={(o) => (o ? null : setCooking(null))}>
        <DialogContent className="max-w-2xl rounded-sheet border-0 bg-card p-6 text-card-foreground">
          <DialogTitle className="font-title text-xl">{recipe.title}</DialogTitle>
          {cooking !== null ? (
            <div className="flex min-h-56 flex-col justify-between gap-6">
              <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase tnum">
                {t("step", { n: cooking + 1, total: recipe.steps.length })}
              </p>
              <p className="font-title text-2xl leading-snug">{recipe.steps[cooking]}</p>
              <div className="flex justify-between">
                <Button
                  variant="ghost"
                  className="text-paper-foreground"
                  disabled={cooking === 0}
                  onClick={() => setCooking((c) => (c ?? 1) - 1)}
                >
                  {t("back")}
                </Button>
                {cooking < recipe.steps.length - 1 ? (
                  <Button onClick={() => setCooking((c) => (c ?? 0) + 1)}>{t("next")}</Button>
                ) : (
                  <Button onClick={() => setCooking(null)}>{t("done")}</Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </CardShell>
  )
}
