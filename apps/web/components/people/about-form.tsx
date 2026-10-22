"use client"

import type { Constraints } from "@najimi/db/schema"
import { Button } from "@najimi/ui/components/button"
import { toast } from "@najimi/ui/components/sonner"
import { Switch } from "@najimi/ui/components/switch"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"
import { AGE_BANDS } from "@/lib/schemas"

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)

const field =
  "w-full rounded-tile bg-paper px-3.5 py-2.5 text-paper-foreground outline-none ring-1 ring-paper-foreground/10 placeholder:text-paper-muted focus:ring-2 focus:ring-ring"

/**
 * Who someone is beyond their loves: city, age, and what to keep in mind (diet, allergies, IDDSI
 * texture, serving temperature, medications, budget). Everything made for them follows it.
 */
export function AboutForm({
  person,
  onRun,
}: {
  person: {
    id: string
    name: string
    isSelf: boolean
    city: string | null
    ageBand: string | null
    constraints: Constraints
  }
  onRun: (runId: string) => void
}) {
  const t = useTranslations("People")
  const router = useRouter()
  const c = person.constraints
  const [city, setCity] = useState(person.city ?? "")
  const [ageBand, setAgeBand] = useState(person.ageBand ?? "")
  const [diet, setDiet] = useState((c.diet ?? []).join(", "))
  const [allergies, setAllergies] = useState((c.allergies ?? []).join(", "))
  const [iddsi, setIddsi] = useState(c.iddsi == null ? "none" : String(c.iddsi))
  const [serveWarm, setServeWarm] = useState(Boolean(c.serveWarm))
  const [medications, setMedications] = useState((c.medications ?? []).join(", "))
  const [budget, setBudget] = useState(c.budget ?? "")
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const { runId } = await api<{ runId: string | null }>(`/api/people/${person.id}`, {
        method: "PATCH",
        json: {
          city: city.trim() || null,
          ageBand: ageBand || null,
          constraints: {
            ...c,
            diet: list(diet),
            allergies: list(allergies),
            iddsi: iddsi === "none" ? null : Number(iddsi),
            serveWarm,
            medications: list(medications),
            budget: budget.trim() || undefined,
          },
        },
      })
      if (runId) onRun(runId)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(t("confirmDelete", { name: person.name }))) return
    await api(`/api/people/${person.id}`, { method: "DELETE" })
    router.push("/people")
  }

  return (
    <section className="flex flex-col gap-5 rounded-card bg-card p-5 text-card-foreground shadow-paper">
      <h2 className="font-heading text-[17px]">{t("about", { name: person.name })}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("city")}
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={field}
            maxLength={120}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("age")}
          <select value={ageBand} onChange={(e) => setAgeBand(e.target.value)} className={field}>
            <option value="">{t("notSet")}</option>
            {AGE_BANDS.map((b) => (
              <option key={b} value={b}>
                {t(`ages.${b}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3 className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
        {t("constraints")}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("diet")}
          <input
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
            placeholder={t("dietPlaceholder")}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("allergies")}
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder={t("allergiesPlaceholder")}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("texture")}
          <select value={iddsi} onChange={(e) => setIddsi(e.target.value)} className={field}>
            {["none", "3", "4", "5", "6", "7"].map((v) => (
              <option key={v} value={v}>
                {t(`textures.${v}` as "textures.none")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("budget")}
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className={field}
            maxLength={80}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">
          {t("medications")}
          <input
            value={medications}
            onChange={(e) => setMedications(e.target.value)}
            placeholder={t("medicationsPlaceholder")}
            className={field}
          />
          <span className="text-xs font-normal text-paper-muted">{t("medicationsNote")}</span>
        </label>
        <div className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
          <Switch checked={serveWarm} onCheckedChange={setServeWarm} aria-label={t("serveWarm")} />
          {t("serveWarm")}
        </div>
      </div>
      {c.notes?.length ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
            {t("notes")}
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {c.notes.map((n) => (
              <li key={n} className="rounded-pill bg-paper-foreground/6 px-2.5 py-1 text-[13px]">
                {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!person.isSelf ? (
          <Button variant="link" className="text-paper-muted" onClick={remove}>
            {t("delete", { name: person.name })}
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </section>
  )
}
