"use client"

import { BLIND_BANDS, bandOf } from "@najimi/games"
import type { BoardRow, Reveal, RoundView } from "@najimi/games/round"
import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Check, Heart, Loader2, Share2, Sparkles, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { celebrate } from "./confetti"
import { Fan } from "./fan"
import { type BoardEntry, Leaderboard } from "./leaderboard"
import { NumberTicker } from "./number-ticker"
import { type BlindAnswer, SwipeDeck, type SwipeHandle } from "./swipe-card"
import { WavelengthDial } from "./wavelength-dial"

/*
 * Playing a round (W9): the round's things dealt as a hand, then one at a time — swing the
 * wavelength needle, swipe Blind Taste's deck, or pick a tile — and each answer opens on Qloo's
 * truth beside Najimi's guess. The end is you against Najimi, then the round's podium.
 * Patterns: Abode's in-thread trivia (Refero b0bf2fc4) for the one-question screen and running
 * tally, Turf's prediction reveal (4cccee1d) for Blind Taste's bar, Airbuds' match result
 * (1904948a) for the face-off. The artwork is the colour: each thing tints the whole screen.
 */

type Stage = "intro" | "play" | "reveal" | "done"
type AnswerResult = {
  reveal: Reveal
  score: number
  done: boolean
  najimiScore: number | null
}

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

/** The picture for an item: its own artwork, or (for "which did they pick?") the first option's. */
const pictureOf = (item: RoundView["items"][number] | undefined) =>
  item?.image ?? item?.options?.find((o) => o.image)?.image ?? null

function Backdrop({ image }: { image: string | null }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <AnimatePresence initial={false}>
        {image ? (
          // biome-ignore lint/performance/noImgElement: remote artwork, blurred as the backdrop
          <motion.img
            key={image}
            src={sized(image, 240) ?? image}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 size-full scale-125 object-cover blur-3xl saturate-150"
          />
        ) : null}
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/90" />
    </div>
  )
}

/** One segment per thing in the round; played ones take the colour of how they went. */
function Segments({ count, reveals, at }: { count: number; reveals: Reveal[]; at: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const r = reveals[i]
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-500",
              r
                ? r.points >= 76
                  ? "bg-success"
                  : r.points >= 50
                    ? "bg-warn"
                    : "bg-danger"
                : i === at
                  ? "bg-foreground/70"
                  : "bg-foreground/15",
            )}
          />
        )
      })}
    </div>
  )
}

function Tally({ view, me }: { view: RoundView; me: { name: string; look: string | null } }) {
  const najimi = view.reveals.reduce((n, r) => n + r.najimiPoints, 0)
  if (view.kind === "blind") {
    const right = view.reveals.filter((r) => r.points === 100).length
    return (
      <span className="glass flex items-center gap-1.5 rounded-pill py-1 ps-1.5 pe-3 text-[13px] font-bold">
        <Sparkles className="size-4 text-signal" />
        <span className="tabular-nums">
          {right}/{view.reveals.length || 0}
        </span>
      </span>
    )
  }
  return (
    <span className="glass flex items-center gap-2 rounded-pill py-1 ps-1 pe-3 text-[13px] font-bold">
      <Face look={me.look} name={me.name} size="xs" />
      <NumberTicker value={view.score} />
      <span className="text-text-4">·</span>
      <Orb size={20} />
      <NumberTicker value={najimi} />
    </span>
  )
}

function Artwork({
  image,
  name,
  caption,
}: {
  image: string | null
  name: string
  caption?: string | null
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="relative size-44 overflow-hidden rounded-card bg-raised shadow-float ring-1 ring-white/10 sm:size-52">
        {image ? (
          // biome-ignore lint/performance/noImgElement: remote artwork
          <img src={sized(image, 480) ?? image} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center p-4 font-heading">{name}</span>
        )}
      </span>
      <span className="flex max-w-[18rem] flex-col">
        <span className="font-heading text-[18px] leading-tight">{name}</span>
        {caption ? <span className="truncate text-[13px] text-text-3">{caption}</span> : null}
      </span>
    </div>
  )
}

function PointsBurst({ points, label }: { points: number; label: string }) {
  const still = useReducedMotion()
  return (
    <motion.div
      initial={still ? false : { scale: 0.6, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      className="flex items-baseline gap-2"
    >
      <span
        className={cn(
          "font-title text-[44px] leading-none",
          points >= 76 ? "text-success" : points >= 50 ? "text-warn" : "text-danger",
        )}
      >
        +<NumberTicker value={points} />
      </span>
      <span className="text-[15px] font-semibold text-text-2">{label}</span>
    </motion.div>
  )
}

/** "Which did they pick?" and "Who loves it?": tiles that open on the truth. */
function Choices({
  item,
  reveal,
  onPick,
  pending,
  people,
}: {
  item: RoundView["items"][number]
  reveal: Reveal | null
  onPick: (i: number) => void
  pending: number | null
  people: boolean
}) {
  const options = item.options ?? []
  const state = (i: number) =>
    !reveal ? "open" : i === reveal.truth ? "right" : i === reveal.answer ? "wrong" : "other"
  if (people)
    return (
      <div className="flex w-full max-w-sm flex-col gap-2">
        {options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            disabled={Boolean(reveal) || pending !== null}
            onClick={() => onPick(i)}
            className={cn(
              "relative flex items-center gap-3 rounded-card px-3 py-3 text-start transition-[transform,background-color,opacity] active:scale-[0.98]",
              state(i) === "right"
                ? "bg-success/20 ring-2 ring-success"
                : state(i) === "wrong"
                  ? "bg-danger/15 ring-2 ring-danger"
                  : state(i) === "other"
                    ? "bg-foreground/[0.06] opacity-50"
                    : "glass hover:bg-foreground/10",
            )}
          >
            <Face look={o.look ?? null} name={o.label} size="sm" />
            <span className="flex-1 font-heading text-[16px]">{o.label}</span>
            {pending === i ? <Loader2 className="size-4 animate-spin" /> : null}
            {reveal && reveal.najimi === i ? <Orb size={22} /> : null}
            {state(i) === "right" ? <Check className="size-5 text-success" /> : null}
            {state(i) === "wrong" ? <X className="size-5 text-danger" /> : null}
          </button>
        ))}
      </div>
    )
  return (
    <div className="grid w-full max-w-sm grid-cols-2 gap-3">
      {options.map((o, i) => (
        <motion.button
          key={o.id}
          type="button"
          whileTap={{ scale: 0.96 }}
          disabled={Boolean(reveal) || pending !== null}
          onClick={() => onPick(i)}
          className={cn(
            "relative aspect-square overflow-hidden rounded-card bg-raised text-start shadow-float transition-[opacity,box-shadow] duration-300",
            state(i) === "right" && "ring-[3px] ring-success",
            state(i) === "wrong" && "ring-[3px] ring-danger",
            state(i) === "other" && "opacity-40",
            state(i) === "open" && "ring-1 ring-white/10 hover:ring-white/40",
          )}
        >
          {o.image ? (
            // biome-ignore lint/performance/noImgElement: remote artwork
            <img
              src={sized(o.image, 320) ?? o.image}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
          <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <span className="absolute inset-x-2.5 bottom-2 line-clamp-2 font-heading text-[14px] leading-tight text-white">
            {o.label}
          </span>
          {pending === i ? (
            <span className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2 className="size-6 animate-spin text-white" />
            </span>
          ) : null}
          {reveal && reveal.najimi === i ? (
            <span className="absolute top-2 end-2 rounded-full ring-2 ring-black/40">
              <Orb size={24} />
            </span>
          ) : null}
          {state(i) === "right" ? (
            <span className="absolute top-2 start-2 grid size-7 place-items-center rounded-full bg-success text-black">
              <Check className="size-4" strokeWidth={3} />
            </span>
          ) : null}
        </motion.button>
      ))}
    </div>
  )
}

/** Blind Taste's verdict: your stamp on the thing, then Qloo's number on a no / maybe / love bar. */
function BlindVerdict({
  item,
  reveal,
  labels,
}: {
  item: RoundView["items"][number]
  reveal: Reveal
  labels: {
    no: string
    maybe: string
    love: string
    qloo: string
    you: string
    right: string
    missed: string
  }
}) {
  const still = useReducedMotion()
  const names = [labels.no, labels.maybe, labels.love]
  const tone = ["border-danger text-danger", "border-warn text-warn", "border-success text-success"]
  const band = bandOf(reveal.truth)
  const right = band === reveal.answer
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-5">
      <motion.div
        initial={still ? false : { opacity: 0, rotate: 8, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, rotate: -3, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 20 }}
        className="relative aspect-[4/5] w-48 overflow-hidden rounded-sheet bg-raised shadow-float ring-1 ring-white/10"
      >
        {pictureOf(item) ? (
          // biome-ignore lint/performance/noImgElement: remote artwork
          <img src={sized(pictureOf(item), 480) ?? ""} alt="" className="size-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <motion.span
          initial={still ? false : { scale: 2.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.25 }}
          className={cn(
            "absolute top-4 start-3 -rotate-12 rounded-tag border-[3px] bg-black/30 px-2.5 py-0.5 font-title text-[20px] backdrop-blur-sm",
            tone[reveal.answer],
          )}
        >
          {names[reveal.answer]}
        </motion.span>
        <span className="absolute inset-x-3 bottom-3 truncate font-heading text-[15px] text-white">
          {item.name}
        </span>
      </motion.div>

      <motion.div
        initial={still ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass flex w-full flex-col gap-3 rounded-sheet p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[12px] font-semibold text-text-3">{labels.qloo}</span>
            <span className="font-title text-[26px] leading-tight">{names[band]}</span>
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[13px] font-bold",
              right ? "bg-success text-black" : "bg-danger text-black",
            )}
          >
            {right ? (
              <Check className="size-4" strokeWidth={3} />
            ) : (
              <X className="size-4" strokeWidth={3} />
            )}
            {right ? labels.right : labels.missed}
          </span>
        </div>
        <div className="relative h-3 w-full rounded-full bg-foreground/10">
          <span
            className="absolute inset-y-0 bg-warn/40"
            style={{
              insetInlineStart: `${BLIND_BANDS.maybe}%`,
              width: `${BLIND_BANDS.love - BLIND_BANDS.maybe}%`,
            }}
          />
          <span
            className="absolute inset-y-0 end-0 rounded-e-full bg-success/45"
            style={{ width: `${100 - BLIND_BANDS.love}%` }}
          />
          <motion.span
            initial={still ? false : { insetInlineStart: "0%" }}
            animate={{ insetInlineStart: `${reveal.truth}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.5 }}
            className="absolute top-1/2 grid h-6 min-w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-pill bg-foreground px-1.5 text-[11px] font-bold text-background tabular-nums rtl:translate-x-1/2"
          >
            {reveal.truth}
          </motion.span>
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-text-3">
          <span>{labels.no}</span>
          <span>{labels.maybe}</span>
          <span>{labels.love}</span>
        </div>
      </motion.div>
    </div>
  )
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className="flex size-24 flex-col items-center justify-center rounded-full bg-foreground/[0.07] ring-1 ring-white/10">
      <span className="font-title text-[24px] leading-none">{value}</span>
      <span className="mt-1 text-[11px] font-semibold text-text-3">{label}</span>
    </span>
  )
}

export function GamePlayer({ initial }: { initial: RoundView }) {
  const t = useTranslations("Games")
  const router = useRouter()
  const [view, setView] = useState(initial)
  const [stage, setStage] = useState<Stage>(
    initial.done ? "done" : initial.reveals.length ? "play" : "intro",
  )
  const [guestName, setGuestName] = useState(initial.me?.name ?? "")
  const [dial, setDial] = useState(50)
  const [pending, setPending] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)
  const deck = useRef<SwipeHandle | null>(null)
  const celebrated = useRef(false)

  const count = view.items.length
  const answered = view.reveals.length
  const index = stage === "reveal" ? answered - 1 : Math.min(answered, count - 1)
  const item = view.items[index]
  const reveal = stage === "reveal" ? (view.reveals[index] ?? null) : null
  const me = view.me ?? { name: guestName.trim() || t("you"), look: null }
  const subjectName = view.mine ? t("youLower") : (view.subject?.name ?? t("them"))

  const board = useQuery({
    queryKey: ["game-board", view.token],
    queryFn: () => api<{ board: BoardRow[] }>(`/api/play/${view.token}/board`),
    enabled: stage === "done",
  })

  const najimiTotal = view.reveals.reduce((n, r) => n + r.najimiPoints, 0)
  const won = view.score > najimiTotal
  useEffect(() => {
    if (stage !== "done" || celebrated.current || view.kind === "blind") return
    celebrated.current = true
    if (won) {
      sound("promote")
      void celebrate()
    }
  }, [stage, won, view.kind])

  async function answer(value: number) {
    if (pending !== null) return
    setPending(value)
    sound("tap")
    try {
      const result = await api<AnswerResult>(`/api/play/${view.token}`, {
        json: {
          index: answered,
          answer: value,
          ...(view.signedIn ? {} : { guestName: guestName.trim() || undefined }),
        },
      })
      setView((v) => ({
        ...v,
        reveals: [...v.reveals, result.reveal],
        score: result.score,
        done: result.done,
        najimiScore: result.najimiScore,
        me: v.me ?? { name: guestName.trim() || t("you"), look: null, aura: null, username: null },
      }))
      setStage("reveal")
      sound(result.reveal.points >= 76 ? "check" : "place")
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setPending(null)
    }
  }

  function next() {
    sound("tap")
    if (view.done) setStage("done")
    else {
      setDial(50)
      setStage("play")
    }
  }

  async function share() {
    const url = `${window.location.origin}/play/${view.token}`
    const right = view.reveals.filter((r) => r.points === 100).length
    const text =
      view.kind === "blind"
        ? t("shareBlind", { percent: Math.round((right / Math.max(view.reveals.length, 1)) * 100) })
        : t("shareText", { score: view.score, title: view.title })
    try {
      if (navigator.share) await navigator.share({ title: view.title, text, url })
      else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        toast(t("copied"), { description: url })
      }
    } catch {
      // The person closed the share sheet.
    }
  }

  async function again() {
    setStarting(true)
    try {
      const about =
        (view.kind === "wavelength" || view.kind === "knowme") && !view.mine
          ? (view.subject?.username ?? undefined)
          : undefined
      const { token } = await api<{ token: string }>("/api/games", {
        json: {
          kind: view.kind,
          ...(about ? { about } : {}),
          // Your own Blind Taste is yours alone; other games go back into the room.
          ...(view.chatId && view.kind !== "blind" ? { chatId: view.chatId } : {}),
        },
      })
      router.push(`/play/${token}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
      setStarting(false)
    }
  }

  const blindLabels = {
    no: t("blind.no"),
    maybe: t("blind.maybe"),
    love: t("blind.love"),
    qloo: t("qlooPredicted"),
    you: t("youSaid"),
    right: t("qlooRightOne"),
    missed: t("qlooMissed"),
  }
  const exit = view.chatId && view.signedIn ? `/c/${view.chatId}` : view.signedIn ? "/people" : "/"
  const backdrop =
    stage === "done" || stage === "intro" ? pictureOf(view.items[0]) : pictureOf(item)

  const verdict = (points: number) =>
    view.kind !== "wavelength"
      ? points === 100
        ? t("rightOne")
        : t("notQuite")
      : points >= 90
        ? t("bullseye")
        : points >= 76
          ? t("close")
          : points >= 50
            ? t("notBad")
            : t("wayOff")

  return (
    <div className="dark relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      <Backdrop image={backdrop} />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),14px)] pb-[max(env(safe-area-inset-bottom),18px)]">
        <header className="flex items-center gap-3">
          <Link
            href={exit}
            aria-label={t("closeLabel")}
            className="glass grid size-10 shrink-0 place-items-center rounded-full"
          >
            <X className="size-5" />
          </Link>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-heading text-[15px]">{view.title}</span>
            {view.subject && view.kind !== "blind" && view.kind !== "twins" ? (
              <span className="truncate text-[12px] text-text-3">
                {view.mine ? t("aboutYou") : t("about", { name: view.subject.name })}
              </span>
            ) : null}
          </span>
          {stage === "play" || stage === "reveal" ? <Tally view={view} me={me} /> : null}
        </header>
        {stage === "play" || stage === "reveal" ? (
          <Segments count={count} reveals={view.reveals} at={answered} />
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          {stage === "intro" ? (
            <motion.main
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
            >
              <Fan
                cards={view.items.map((it, i) => ({
                  key: `${it.qlooId}-${i}`,
                  image: sized(pictureOf(it), 320),
                  label: view.kind === "knowme" ? "?" : it.name,
                }))}
              />
              <div className="-mt-6 flex items-center gap-2">
                <span className="rounded-full ring-4 ring-background">
                  {view.subject && view.kind !== "blind" ? (
                    <Face look={view.subject.look} name={view.subject.name} size="lg" />
                  ) : (
                    <Face look={me.look} name={me.name} size="lg" />
                  )}
                </span>
                <span className="font-title text-[18px] text-text-3">{t("vs")}</span>
                <span className="rounded-full ring-4 ring-background">
                  <Orb size={64} />
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="font-title text-title-sm">{view.title}</h1>
                <p className="mx-auto max-w-[19rem] text-[15px] text-text-2">
                  {t(`pitch.${view.kind}`, { name: subjectName, count })}
                </p>
              </div>
              {view.kind === "blind" && !view.mine ? (
                <p className="text-[14px] text-text-3">
                  {t("dealtFor", { name: view.subject?.name ?? t("them") })}
                </p>
              ) : view.signedIn ? null : (
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value.slice(0, 40))}
                  placeholder={t("namePlaceholder")}
                  aria-label={t("yourName")}
                  className="glass h-12 w-full max-w-xs rounded-pill px-5 text-center text-[16px] outline-none placeholder:text-text-3 focus-visible:ring-2 focus-visible:ring-signal"
                />
              )}
              {view.kind === "blind" && !view.mine ? (
                view.signedIn ? (
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => void again()}
                    className="flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-pill bg-foreground font-heading text-[17px] text-background shadow-float active:scale-[0.98] disabled:opacity-60"
                  >
                    {starting ? <Loader2 className="size-5 animate-spin" /> : null}
                    {t("dealMine")}
                  </button>
                ) : (
                  <Link
                    href="/start"
                    className="flex h-14 w-full max-w-xs items-center justify-center rounded-pill bg-foreground font-heading text-[17px] text-background shadow-float"
                  >
                    {t("makeYours")}
                  </Link>
                )
              ) : (
                <div className="flex w-full max-w-xs flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={!view.signedIn && !guestName.trim()}
                    onClick={() => {
                      sound("tap")
                      setStage("play")
                    }}
                    className="h-14 w-full rounded-pill bg-foreground font-heading text-[17px] text-background shadow-float transition-[transform,opacity] active:scale-[0.98] disabled:opacity-40"
                  >
                    {t("play")}
                  </button>
                  {view.mine && view.kind !== "blind" ? (
                    <button
                      type="button"
                      onClick={() => void share()}
                      className="glass flex h-12 items-center justify-center gap-2 rounded-pill font-heading text-[15px]"
                    >
                      <Share2 className="size-4" />
                      {t("sendFriends")}
                    </button>
                  ) : null}
                </div>
              )}
            </motion.main>
          ) : null}

          {(stage === "play" || stage === "reveal") && item ? (
            <motion.main
              key={`item-${index}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="flex flex-1 flex-col items-center gap-5"
            >
              <p className="text-[13px] font-semibold text-text-3">
                {t("ofCount", { n: index + 1, count })}
              </p>

              {view.kind === "wavelength" ? (
                <>
                  <Artwork image={item.image} name={item.name} caption={item.caption} />
                  <h2 className="text-center font-title text-[24px] leading-tight">
                    {view.mine
                      ? t("ask.wavelengthMine")
                      : t("ask.wavelength", { name: subjectName })}
                  </h2>
                  {reveal ? (
                    <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold">
                      <span className="flex items-center gap-1.5 rounded-pill bg-foreground px-3 py-1 text-background">
                        {t("you")} {reveal.answer}
                      </span>
                      <span className="rounded-pill bg-signal px-3 py-1 text-signal-foreground">
                        Qloo {reveal.truth}
                      </span>
                      <span className="flex items-center gap-1.5 rounded-pill bg-aura-2/25 py-1 ps-1 pe-3 text-foreground ring-1 ring-aura-2/60">
                        <Orb size={18} /> {reveal.najimi}
                      </span>
                    </div>
                  ) : (
                    <span className="font-title text-[44px] leading-none tabular-nums">{dial}</span>
                  )}
                  <WavelengthDial
                    value={reveal ? reveal.answer : dial}
                    onChange={reveal || pending !== null ? undefined : setDial}
                    reveal={reveal ? { truth: reveal.truth, najimi: reveal.najimi } : null}
                    low={view.mine ? t("lowMine") : t("low")}
                    high={t("high")}
                    label={t("dial")}
                  />
                </>
              ) : null}

              {view.kind === "blind" ? (
                reveal ? (
                  <BlindVerdict item={item} reveal={reveal} labels={blindLabels} />
                ) : (
                  <>
                    <h2 className="text-center font-title text-[24px] leading-tight">
                      {t("ask.blind")}
                    </h2>
                    <SwipeDeck
                      key={`deck-${index}`}
                      image={sized(item.image, 640)}
                      behind={view.items.slice(index + 1).map((it) => sized(it.image, 320))}
                      onAnswer={(a: BlindAnswer) => void answer(a)}
                      stamps={{ love: t("blind.love"), maybe: t("blind.maybe"), no: t("blind.no") }}
                      disabled={pending !== null}
                      handle={(h) => {
                        deck.current = h
                      }}
                    >
                      <span className="block font-title text-[24px] leading-tight">
                        {item.name}
                      </span>
                      {item.caption ? (
                        <span className="mt-1 block text-[13px] text-white/70">{item.caption}</span>
                      ) : null}
                    </SwipeDeck>
                    <div className="flex items-center gap-5">
                      {(
                        [
                          {
                            a: 0,
                            icon: <X className="size-7" strokeWidth={2.5} />,
                            cls: "text-danger size-16",
                            label: t("blind.no"),
                          },
                          {
                            a: 1,
                            icon: <span className="font-title text-[18px]">?</span>,
                            cls: "text-warn size-12",
                            label: t("blind.maybe"),
                          },
                          {
                            a: 2,
                            icon: <Heart className="size-7 fill-current" />,
                            cls: "text-success size-16",
                            label: t("blind.love"),
                          },
                        ] as const
                      ).map((b) => (
                        <button
                          key={b.a}
                          type="button"
                          aria-label={b.label}
                          disabled={pending !== null}
                          onClick={() => deck.current?.fling(b.a)}
                          className={cn(
                            "glass grid place-items-center rounded-full ring-1 ring-white/10 transition-transform active:scale-90",
                            b.cls,
                          )}
                        >
                          {b.icon}
                        </button>
                      ))}
                    </div>
                  </>
                )
              ) : null}

              {view.kind === "knowme" || view.kind === "twins" ? (
                <>
                  {view.kind === "twins" ? (
                    <Artwork image={item.image} name={item.name} caption={item.caption} />
                  ) : null}
                  <h2 className="text-center font-title text-[24px] leading-tight">
                    {view.kind === "twins"
                      ? t("ask.twins")
                      : t("ask.knowme", { name: subjectName })}
                  </h2>
                  <Choices
                    item={item}
                    reveal={reveal}
                    pending={pending}
                    people={view.kind === "twins"}
                    onPick={(i) => void answer(i)}
                  />
                </>
              ) : null}

              {reveal && view.kind !== "blind" ? (
                <PointsBurst points={reveal.points} label={verdict(reveal.points)} />
              ) : null}

              <div className="mt-auto flex w-full justify-center pt-2">
                {view.kind === "wavelength" && !reveal ? (
                  <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => void answer(dial)}
                    className="flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-pill bg-foreground font-heading text-[17px] text-background shadow-float transition-transform active:scale-[0.98] disabled:opacity-50"
                  >
                    {pending !== null ? <Loader2 className="size-5 animate-spin" /> : null}
                    {t("lockIn")}
                  </button>
                ) : null}
                {reveal ? (
                  <button
                    type="button"
                    onClick={next}
                    className="h-14 w-full max-w-xs rounded-pill bg-foreground font-heading text-[17px] text-background shadow-float transition-transform active:scale-[0.98]"
                  >
                    {view.done ? t("seeResult") : t("next")}
                  </button>
                ) : null}
              </div>
            </motion.main>
          ) : null}

          {stage === "done" ? (
            <motion.main
              key="done"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col items-center gap-6 pb-4 text-center"
            >
              <Result
                view={view}
                me={me}
                najimiTotal={najimiTotal}
                labels={{
                  won: t("result.won"),
                  lost: t("result.lost"),
                  tie: t("result.tie"),
                  blindTitle: t("result.blind"),
                  right: t("statRight"),
                  closest: t("statClosest"),
                  average: t("statAverage"),
                  score: t("statScore"),
                  najimi: "Najimi",
                }}
              />
              <Fan
                size="sm"
                cards={view.items.map((it, i) => {
                  const r = view.reveals[i]
                  return {
                    key: `${it.qlooId}-${i}`,
                    image: sized(pictureOf(it), 320),
                    label: it.name,
                    mark: r
                      ? view.kind === "blind" || view.kind === "knowme" || view.kind === "twins"
                        ? r.points === 100
                          ? "✓"
                          : "✗"
                        : `+${r.points}`
                      : null,
                  }
                })}
              />
              <div className="flex w-full max-w-xs flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => void share()}
                  className="flex h-14 items-center justify-center gap-2 rounded-pill bg-foreground font-heading text-[17px] text-background shadow-float active:scale-[0.98]"
                >
                  <Share2 className="size-5" />
                  {view.kind === "blind" ? t("shareMine") : t("share")}
                </button>
                {view.signedIn ? (
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => void again()}
                    className="glass flex h-12 items-center justify-center gap-2 rounded-pill font-heading text-[15px] disabled:opacity-60"
                  >
                    {starting ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("again")}
                  </button>
                ) : (
                  <Link
                    href="/start"
                    className="glass flex h-12 items-center justify-center rounded-pill font-heading text-[15px]"
                  >
                    {t("makeYours")}
                  </Link>
                )}
                {view.chatId && view.signedIn ? (
                  <Link
                    href={`/c/${view.chatId}`}
                    className="flex h-10 items-center justify-center text-[14px] font-semibold text-text-2"
                  >
                    {t("backToCircle")}
                  </Link>
                ) : null}
              </div>
              {view.kind !== "blind" && board.data && board.data.board.length >= 3 ? (
                <section className="flex w-full flex-col gap-4 text-start">
                  <h2 className="font-heading text-[17px]">{t("board")}</h2>
                  <Leaderboard
                    you={t("you")}
                    entries={board.data.board.map(
                      (row, i): BoardEntry => ({
                        key: `${row.najimi ? "najimi" : (row.username ?? row.name)}-${i}`,
                        name: row.name,
                        look: row.look,
                        score: row.score,
                        username: row.username,
                        najimi: row.najimi,
                        me: row.me,
                      }),
                    )}
                  />
                </section>
              ) : null}
            </motion.main>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** The end of a round: you against Najimi (or, for Blind Taste, how well Qloo read you). */
function Result({
  view,
  me,
  najimiTotal,
  labels,
}: {
  view: RoundView
  me: { name: string; look: string | null }
  najimiTotal: number
  labels: Record<
    "won" | "lost" | "tie" | "blindTitle" | "right" | "closest" | "average" | "score" | "najimi",
    string
  >
}) {
  const still = useReducedMotion()
  const n = view.reveals.length || 1
  const right = view.reveals.filter((r) => r.points === 100).length
  if (view.kind === "blind") {
    const percent = Math.round((right / n) * 100)
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="relative grid size-44 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              strokeWidth="8"
              className="stroke-foreground/10"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-signal"
              initial={still ? false : { pathLength: 0 }}
              animate={{ pathLength: percent / 100 }}
              transition={{ duration: 1.1, ease: [0.23, 1, 0.32, 1] }}
            />
          </svg>
          <span className="font-title text-[48px] leading-none">
            <NumberTicker value={percent} />%
          </span>
        </div>
        <h1 className="font-title text-title-sm">{labels.blindTitle}</h1>
        <Stat value={`${right}/${view.reveals.length}`} label={labels.right} />
      </div>
    )
  }
  const won = view.score > najimiTotal
  const tie = view.score === najimiTotal
  const offs = view.reveals.map((r) => Math.abs(r.answer - r.truth))
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex w-full items-end justify-center gap-6">
        {[
          {
            key: "me",
            face: <Face look={me.look} name={me.name} size="xl" />,
            score: view.score,
            win: won,
            name: me.name,
          },
          {
            key: "najimi",
            face: <Orb size={96} />,
            score: najimiTotal,
            win: !won && !tie,
            name: labels.najimi,
          },
        ].map((side, i) => (
          <motion.div
            key={side.key}
            initial={still ? false : { opacity: 0, x: i ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.1 * i }}
            className={cn("flex flex-col items-center gap-2", side.win ? "" : "opacity-70")}
          >
            <span
              className={cn(
                "rounded-full",
                side.win && "shadow-[0_0_60px_-6px_var(--color-signal)] ring-[3px] ring-signal",
              )}
            >
              {side.face}
            </span>
            <span className="max-w-[8rem] truncate text-[13px] font-semibold text-text-2">
              {side.name}
            </span>
            <span
              className={cn("font-title leading-none", side.win ? "text-[52px]" : "text-[36px]")}
            >
              <NumberTicker value={side.score} delay={0.2} />
            </span>
          </motion.div>
        ))}
      </div>
      <h1 className="font-title text-title-sm">
        {won ? labels.won : tie ? labels.tie : labels.lost}
      </h1>
      <div className="flex gap-3">
        {view.kind === "wavelength" ? (
          <>
            <Stat value={Math.min(...offs)} label={labels.closest} />
            <Stat value={Math.round(offs.reduce((a, b) => a + b, 0) / n)} label={labels.average} />
          </>
        ) : (
          <>
            <Stat value={`${right}/${view.reveals.length}`} label={labels.right} />
            <Stat
              value={`${view.reveals.filter((r) => r.najimiPoints === 100).length}/${view.reveals.length}`}
              label={labels.najimi}
            />
          </>
        )}
      </div>
    </div>
  )
}
