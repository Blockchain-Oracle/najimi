"use client"

import { AUTH, LOOKS, type LookId, TASTE } from "@najimi/config"
import { Button } from "@najimi/ui/components/button"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"
import { LanguageMenu } from "@/components/language-menu"
import type { LoveHit } from "@/components/loves/love-search"
import { authClient, ensureSession } from "@/lib/auth-client"
import { api } from "@/lib/fetcher"
import { primeSounds, sound } from "@/lib/sounds"
import { useDebounced } from "@/lib/use-debounced"
import { type City, CityMap } from "./city-map"
import { LOOK_BG, LookCard, lookSrc, type UsernameState } from "./look-card"
import { LoveGrid } from "./love-grid"
import { WeightCards } from "./weight-cards"

type Picked = LoveHit & { weight: number }
const STEPS = 4

/** A username from a name: lowercase letters, digits, dots and underscores (the plugin's rule). */
const toUsername = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, AUTH.usernameMax)
const USERNAME = new RegExp(`^[a-z0-9._]{${AUTH.usernameMin},${AUTH.usernameMax}}$`)

/**
 * Meeting Najimi (C1): the face you'll wear and your name, your city on a map, three or more
 * things you love (Qloo artwork, tap or search), how much each counts, then the live reveal. A
 * guest session starts on the first search. Someone who came from a shared link (`next`) carries
 * on there after the reveal.
 */
export function Onboarding({ next }: { next: string | null }) {
  const t = useTranslations("Start")
  const locale = useLocale()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [look, setLook] = useState<LookId>(LOOKS[0].id)
  const [name, setName] = useState<string>(LOOKS[0].name)
  const [city, setCity] = useState<City | null>(null)
  const [loves, setLoves] = useState<Picked[]>([])
  // The username follows the name until someone types their own.
  const [username, setUsername] = useState(toUsername(LOOKS[0].name))
  const [ownUsername, setOwnUsername] = useState(false)
  useEffect(() => {
    if (!ownUsername) setUsername(toUsername(name))
  }, [name, ownUsername])
  const settled = useDebounced(username, AUTH.usernameCheckDebounceMs)
  const validUsername = USERNAME.test(username)
  const availability = useQuery({
    queryKey: ["username-free", settled],
    enabled: USERNAME.test(settled),
    staleTime: 30_000,
    queryFn: async () => {
      const r = await authClient.isUsernameAvailable({ username: settled })
      return r.data?.available ?? false
    },
  })
  // A name Najimi suggested that's taken quietly becomes a free one (juno → juno482); only a
  // username someone typed themselves shows "taken".
  useEffect(() => {
    if (ownUsername || availability.data !== false || settled !== username) return
    const base = toUsername(name).slice(0, AUTH.usernameMax - 3) || "najimi"
    setUsername(`${base}${Math.floor(100 + Math.random() * 900)}`)
  }, [ownUsername, availability.data, settled, username, name])
  const usernameState: UsernameState = !username
    ? "empty"
    : !validUsername
      ? "invalid"
      : settled !== username || availability.isPending
        ? "checking"
        : availability.data
          ? "free"
          : "taken"
  const [error, setError] = useState<string | null>(null)
  const [revealing, startReveal] = useTransition()

  const current = LOOKS.find((l) => l.id === look) ?? LOOKS[0]
  const missing = Math.max(0, TASTE.lovesMin - loves.length)

  const go = (to: number) => {
    primeSounds()
    sound("tap")
    setDirection(to > step ? 1 : -1)
    setStep(to)
  }

  const toggleLove = (hit: LoveHit) =>
    setLoves((all) =>
      all.some((l) => l.qlooId === hit.qlooId)
        ? all.filter((l) => l.qlooId !== hit.qlooId)
        : all.length >= TASTE.lovesMax
          ? all
          : [...all, { ...hit, weight: TASTE.weightDefault }],
    )

  function reveal() {
    setError(null)
    sound("promote")
    startReveal(async () => {
      try {
        await ensureSession()
        const claimed = await authClient.updateUser({ username, displayUsername: username })
        if (claimed.error) {
          setStep(1)
          throw new Error(claimed.error.message ?? "")
        }
        const { personId } = await api<{ personId: string; runId: string }>("/api/people", {
          json: {
            isSelf: true,
            name: name.trim() || current.name,
            look,
            city: city?.name ?? null,
            cityLat: city?.lat ?? null,
            cityLon: city?.lon ?? null,
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
        router.push(`/people/${personId}${next ? `?next=${encodeURIComponent(next)}` : ""}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : "")
      }
    })
  }

  const titles = [t("nameTitle"), t("cityTitle"), t("lovesTitle"), t("weightsTitle")]
  const hints = [t("lookHint"), t("cityHint"), t("lovesHint"), t("weightsHint")]

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pt-5 pb-32">
      <header className="flex items-center gap-3">
        <span
          className={cn(
            "size-10 shrink-0 overflow-hidden rounded-full ring-2 ring-foreground/15",
            LOOK_BG[current.identity],
          )}
        >
          {/* biome-ignore lint/performance/noImgElement: a static face from public/ */}
          <img src={lookSrc(current.id)} alt="" className="size-full object-cover" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="truncate text-sm font-semibold">
            {name.trim() || current.name}
            {city ? <span className="text-text-3"> · {city.name}</span> : null}
          </span>
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS}
            aria-valuenow={step}
            aria-label={t("step", { current: step, total: STEPS })}
          >
            {Array.from({ length: STEPS }, (_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: one segment per step, fixed order
                key={i}
                className="h-1.5 flex-1 overflow-hidden rounded-pill bg-foreground/12"
              >
                <motion.span
                  className="block h-full rounded-pill bg-lime"
                  initial={false}
                  animate={{ width: i < step ? "100%" : "0%" }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                />
              </span>
            ))}
          </div>
        </div>
        <LanguageMenu />
      </header>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.section
          key={step}
          custom={direction}
          initial={{ opacity: 0, x: direction * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -40 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-1 flex-col gap-6 pt-8"
        >
          <div className="flex flex-col gap-2">
            <h1 className="font-title text-title-sm">{titles[step - 1]}</h1>
            <p className="text-text-2">{hints[step - 1]}</p>
          </div>

          {step === 1 ? (
            <LookCard
              look={look}
              name={name}
              onLook={setLook}
              onName={setName}
              username={username}
              usernameState={usernameState}
              onUsername={(value) => {
                setOwnUsername(true)
                setUsername(value.toLowerCase().replace(/[^a-z0-9._]/g, ""))
              }}
            />
          ) : null}
          {step === 2 ? (
            <CityMap city={city} onCity={setCity} ensureSession={ensureSession} />
          ) : null}
          {step === 3 ? (
            <LoveGrid loves={loves} onToggle={toggleLove} ensureSession={ensureSession} />
          ) : null}
          {step === 4 ? (
            <>
              <WeightCards
                loves={loves}
                onWeight={(id, weight) =>
                  setLoves((all) => all.map((l) => (l.qlooId === id ? { ...l, weight } : l)))
                }
              />
              {error ? <p className="text-destructive">{error}</p> : null}
            </>
          ) : null}
        </motion.section>
      </AnimatePresence>

      <footer className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-transparent pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5">
          {step > 1 ? (
            <Button
              variant="sticker"
              size="icon-lg"
              aria-label={t("back")}
              onClick={() => go(step - 1)}
            >
              <ArrowLeft className="rtl:-scale-x-100" />
            </Button>
          ) : (
            <span />
          )}
          {step === 1 ? (
            <Button
              size="lg"
              disabled={!name.trim() || usernameState !== "free"}
              onClick={() => go(2)}
            >
              {t("next")} <ArrowRight className="rtl:-scale-x-100" />
            </Button>
          ) : step === 2 ? (
            <Button size="lg" onClick={() => go(3)}>
              {city ? t("next") : t("skipCity")} <ArrowRight className="rtl:-scale-x-100" />
            </Button>
          ) : step === 3 ? (
            <Button
              size="lg"
              disabled={missing > 0}
              onClick={() => go(4)}
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
