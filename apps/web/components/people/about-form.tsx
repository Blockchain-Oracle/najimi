"use client"

import { Button } from "@najimi/ui/components/button"
import { toast } from "@najimi/ui/components/sonner"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"

const field =
  "w-full rounded-tile bg-paper px-3.5 py-2.5 text-paper-foreground outline-none ring-1 ring-paper-foreground/10 placeholder:text-paper-muted focus:ring-2 focus:ring-ring"

/** Where someone is: their city decides the places and the map. A new city recomputes places. */
export function AboutForm({
  person,
  onRun,
}: {
  person: { id: string; name: string; city: string | null }
  onRun: (runId: string) => void
}) {
  const t = useTranslations("People")
  const router = useRouter()
  const [city, setCity] = useState(person.city ?? "")
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const { runId } = await api<{ runId: string | null }>(`/api/people/${person.id}`, {
        method: "PATCH",
        json: { city: city.trim() || null },
      })
      if (runId) onRun(runId)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-card bg-card p-5 text-card-foreground shadow-paper">
      <h2 className="font-heading text-[17px]">{t("about", { name: person.name })}</h2>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("city")}
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={field}
          maxLength={120}
        />
      </label>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </section>
  )
}
