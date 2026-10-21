"use client"

import type { NajimiTools } from "@najimi/agent"
import { cn } from "@najimi/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { WithPerson } from "../chat-context"
import { CardShell } from "./insights-card"

type Plan = NajimiTools["mealPlan"]["input"]

/** A week of meals and the shopping list that goes with it (tick things off as you shop). */
export function MealPlanCard({ plan, personName }: { plan: Plan; personName: string }) {
  const t = useTranslations("Food")
  const [got, setGot] = useState<Set<string>>(new Set())
  const aisles = new Map<string, Plan["shopping"]>()
  for (const s of plan.shopping) aisles.set(s.aisle, [...(aisles.get(s.aisle) ?? []), s])
  return (
    <CardShell title={plan.title} callId={null}>
      <p className="text-sm text-paper-muted">
        <WithPerson text={(name) => t("forName", { name })} name={personName} />
      </p>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {plan.days.map((d) => (
          <div
            key={d.day}
            className="flex w-48 shrink-0 snap-start flex-col gap-1.5 rounded-tile border border-paper-foreground/10 p-3"
          >
            <p className="font-title">{d.day}</p>
            {d.meals.map((m) => (
              <p key={`${m.slot}-${m.name}`} className="text-sm">
                <span className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
                  {m.slot}{" "}
                </span>
                {m.name}
                {m.note ? <span className="block text-xs text-paper-muted">{m.note}</span> : null}
              </p>
            ))}
          </div>
        ))}
      </div>
      {plan.shopping.length ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
            {t("shopping")}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...aisles.entries()].map(([aisle, items]) => (
              <div key={aisle}>
                <p className="text-xs font-semibold">{aisle}</p>
                <ul>
                  {items.map((s) => {
                    const key = `${aisle}-${s.item}`
                    return (
                      <li key={key}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2 py-0.5 text-sm",
                            got.has(key) && "text-paper-muted line-through",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={got.has(key)}
                            onChange={() =>
                              setGot((g) => {
                                const n = new Set(g)
                                if (n.has(key)) n.delete(key)
                                else n.add(key)
                                return n
                              })
                            }
                            className="accent-lime-ink"
                          />
                          {s.item} <span className="text-paper-muted">{s.amount}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </CardShell>
  )
}
