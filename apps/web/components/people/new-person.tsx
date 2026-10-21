"use client"

import { TASTE } from "@najimi/config"
import { Button } from "@najimi/ui/components/button"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { LovePill } from "@/components/loves/love-pill"
import { type LoveHit, LoveSearch } from "@/components/loves/love-search"
import { api } from "@/lib/fetcher"
import { AGE_BANDS } from "@/lib/schemas"

const field =
  "w-full rounded-pill bg-card px-5 py-3 text-card-foreground shadow-paper outline-none placeholder:text-paper-muted focus:ring-2 focus:ring-ring"

/** Someone I make for (T3): who they are and what they love; the rest is edited on their page. */
export function NewPerson() {
  const t = useTranslations("People")
  const ts = useTranslations("Start")
  const router = useRouter()
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [ageBand, setAgeBand] = useState("")
  const [loves, setLoves] = useState<LoveHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, start] = useTransition()
  const picked = new Set(loves.map((l) => l.qlooId))

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-16 md:px-0">
      <h1 className="font-title text-title-sm">{t("newTitle")}</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={ts("namePlaceholder")}
        className={field}
        maxLength={80}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={ts("cityPlaceholder")}
          className={field}
          maxLength={120}
        />
        <select
          value={ageBand}
          onChange={(e) => setAgeBand(e.target.value)}
          className={field}
          aria-label={t("age")}
        >
          <option value="">{t("age")}</option>
          {AGE_BANDS.map((b) => (
            <option key={b} value={b}>
              {t(`ages.${b}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="font-title text-xl">{t("theirLoves")}</h2>
        <p className="text-sm text-text-2">{t("theirLovesHint")}</p>
        {loves.length ? (
          <div className="flex flex-wrap gap-2">
            {loves.map((l) => (
              <LovePill
                key={l.qlooId}
                name={l.name}
                image={l.image}
                type={l.type}
                onRemove={() => setLoves((all) => all.filter((x) => x.qlooId !== l.qlooId))}
              />
            ))}
          </div>
        ) : null}
        <LoveSearch
          picked={picked}
          onPick={(hit) => setLoves((all) => (all.length >= TASTE.lovesMax ? all : [...all, hit]))}
        />
      </div>
      {error ? <p className="text-destructive">{error}</p> : null}
      <Button
        size="lg"
        className="self-end"
        disabled={!name.trim() || !loves.length || saving}
        onClick={() =>
          start(async () => {
            try {
              const { personId } = await api<{ personId: string }>("/api/people", {
                json: {
                  name: name.trim(),
                  city: city.trim() || null,
                  ageBand: ageBand || null,
                  loves: loves.map((l) => ({
                    qlooId: l.qlooId,
                    type: l.type,
                    name: l.name,
                    image: l.image,
                    weight: TASTE.weightDefault,
                  })),
                },
              })
              router.push(`/people/${personId}`)
            } catch (e) {
              setError(e instanceof Error ? e.message : "")
            }
          })
        }
      >
        {saving ? t("saving") : t("revealTheirs")}
      </Button>
    </div>
  )
}
