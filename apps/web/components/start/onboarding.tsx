"use client"

import { LOCALES, TASTE } from "@najimi/config"
import { Button } from "@najimi/ui/components/button"
import { Slider } from "@najimi/ui/components/slider"
import { cn } from "@najimi/ui/lib/utils"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Artwork, shapeOf } from "@/components/artwork"
import { LovePill } from "@/components/loves/love-pill"
import { type LoveHit, LoveSearch } from "@/components/loves/love-search"
import { ensureSession } from "@/lib/auth-client"
import { api } from "@/lib/fetcher"
import { setLocale } from "@/lib/locale"

type Picked = LoveHit & { weight: number }
const STEPS = 3

/**
 * "Who are you" (C1): a name and a city, three or more things you love (live Qloo artwork), how
 * much each counts, then the reveal. A guest session starts on the first search.
 */
export function Onboarding() {
  const t = useTranslations("Start")
  const tl = useTranslations("Loves")
  const locale = useLocale()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [loves, setLoves] = useState<Picked[]>([])
  const [error, setError] = useState<string | null>(null)
  const [revealing, startReveal] = useTransition()
  const [, startLocale] = useTransition()

  const picked = new Set(loves.map((l) => l.qlooId))
  const missing = Math.max(0, TASTE.lovesMin - loves.length)

  function reveal() {
    setError(null)
    startReveal(async () => {
      try {
        await ensureSession()
        const { personId } = await api<{ personId: string; runId: string }>("/api/people", {
          json: {
            isSelf: true,
            name: name.trim(),
            city: city.trim() || null,
            locale,
            loves: loves.map((l) => ({
              qlooId: l.qlooId,
              type: l.type,
              name: l.name,
              image: l.image,
              weight: l.weight,
            })),
          },
        })
        router.push(`/people/${personId}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : "")
      }
    })
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-xl flex-col px-5 pt-6 pb-28">
      <header className="flex items-center justify-between">
        <span className="font-title text-xl">najimi</span>
        <span className="sticker px-3 py-1 text-xs font-semibold tnum">
          {t("step", { current: step, total: STEPS })}
        </span>
      </header>

      {step === 1 ? (
        <section className="flex flex-1 flex-col gap-8 pt-14">
          <h1 className="font-title text-title-sm">{t("nameTitle")}</h1>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            // biome-ignore lint/a11y/noAutofocus: the step's only question; focus is where the person types next
            autoFocus
            maxLength={80}
            className="w-full rounded-pill bg-card px-5 py-3.5 text-lg text-card-foreground shadow-paper outline-none placeholder:text-paper-muted focus:ring-2 focus:ring-ring"
          />
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t("cityLabel")}</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("cityPlaceholder")}
              maxLength={120}
              className="w-full rounded-pill bg-card px-5 py-3 text-card-foreground shadow-paper outline-none placeholder:text-paper-muted focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-text-3">{t("cityHint")}</span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t("languageLabel")}</span>
            <select
              value={locale}
              onChange={(e) => {
                const next = e.target.value
                startLocale(async () => {
                  await setLocale(next)
                  router.refresh()
                })
              }}
              className="w-full rounded-pill bg-card px-5 py-3 text-card-foreground shadow-paper outline-none"
            >
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-1 flex-col gap-5 pt-10">
          <div className="flex flex-col gap-2">
            <h1 className="font-title text-title-sm">{t("lovesTitle")}</h1>
            <p className="text-text-2">{t("lovesHint")}</p>
          </div>
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
            autoFocus
            ensureSession={ensureSession}
            onPick={(hit) =>
              setLoves((all) =>
                all.length >= TASTE.lovesMax
                  ? all
                  : [...all, { ...hit, weight: TASTE.weightDefault }],
              )
            }
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="flex flex-1 flex-col gap-6 pt-10">
          <div className="flex flex-col gap-2">
            <h1 className="font-title text-title-sm">{t("weightsTitle")}</h1>
            <p className="text-text-2">{t("weightsHint")}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {loves.map((l) => (
              <li
                key={l.qlooId}
                className="flex items-center gap-4 rounded-card bg-card p-3 text-card-foreground shadow-paper"
              >
                <Artwork
                  src={l.image}
                  name={l.name}
                  shape={shapeOf(l.type)}
                  className="w-14 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <span className="truncate font-semibold">{l.name}</span>
                  <div className="flex items-center gap-3 text-xs text-paper-muted">
                    <span className="whitespace-nowrap">{tl("less")}</span>
                    <Slider
                      value={[l.weight]}
                      min={TASTE.weightMin}
                      max={TASTE.weightMax}
                      step={1}
                      aria-label={tl("weight")}
                      onValueChange={(v) => {
                        const next = Array.isArray(v) ? (v[0] ?? l.weight) : v
                        setLoves((all) =>
                          all.map((x) => (x.qlooId === l.qlooId ? { ...x, weight: next } : x)),
                        )
                      }}
                    />
                    <span className="whitespace-nowrap">{tl("more")}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {error ? <p className="text-destructive">{error}</p> : null}
        </section>
      ) : null}

      <footer className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-5">
          {step > 1 ? (
            <Button
              variant="sticker"
              size="icon-lg"
              aria-label={t("back")}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="rtl:-scale-x-100" />
            </Button>
          ) : (
            <span />
          )}
          {step === 1 ? (
            <Button size="lg" disabled={!name.trim()} onClick={() => setStep(2)}>
              {t("next")} <ArrowRight className="rtl:-scale-x-100" />
            </Button>
          ) : step === 2 ? (
            <Button
              size="lg"
              disabled={missing > 0}
              onClick={() => setStep(3)}
              className={cn(missing > 0 && "opacity-60")}
            >
              {missing > 0 ? t("pickMore", { count: missing }) : t("next")}
              {missing === 0 ? <ArrowRight className="rtl:-scale-x-100" /> : null}
            </Button>
          ) : (
            <Button size="lg" disabled={revealing} onClick={reveal}>
              {revealing ? t("revealing") : t("reveal")}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
