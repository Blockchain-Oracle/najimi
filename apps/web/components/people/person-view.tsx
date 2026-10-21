"use client"

import { TASTE_DOMAINS } from "@najimi/config"
import type { Constraints, StoredPick, TasteWords } from "@najimi/db/schema"
import { Button } from "@najimi/ui/components/button"
import { toast } from "@najimi/ui/components/sonner"
import { MapPin, Share2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { LovePill } from "@/components/loves/love-pill"
import { MoreSheet } from "@/components/picks/more-sheet"
import type { PickActions } from "@/components/picks/pick-card"
import { PickRail } from "@/components/picks/pick-rail"
import { BuiltOnQloo } from "@/components/qloo/built-on-qloo"
import { LovesFan, TasteWordsView } from "@/components/taste/taste-card"
import { api } from "@/lib/fetcher"
import { shareLink } from "@/lib/share-link"
import { type RunEvent, useRunEvents } from "@/lib/use-run"
import { AboutForm } from "./about-form"
import { type EditableLove, LovesEditor } from "./loves-editor"

export type PersonViewData = {
  person: {
    id: string
    name: string
    isSelf: boolean
    city: string | null
    ageBand: string | null
    constraints: Constraints
  }
  identity: string
  loves: EditableLove[]
  taste: {
    words: TasteWords | null
    picks: Record<string, StoredPick[]> | null
    bridges: { from: string; to: string; domain: string }[] | null
    runId: string | null
    computedAt: string | null
  } | null
  runStatus: string | null
  saved: { qlooId: string; type: string; name: string; imageUrl: string | null }[]
}

const LIVE = new Set(["queued", "running", "waiting"])

/**
 * A person's taste page and its live reveal (C1): the words land first, then each domain's picks as
 * Qloo answers, watched over the run's event stream. Every change to their loves starts a new run.
 */
export function PersonView({ data }: { data: PersonViewData }) {
  const t = useTranslations("Taste")
  const tp = useTranslations("Pick")
  const td = useTranslations("Domains")
  const router = useRouter()
  const { person } = data
  const [runId, setRunId] = useState(data.taste?.runId ?? null)
  const [live, setLive] = useState(Boolean(data.runStatus && LIVE.has(data.runStatus)))
  const [failed, setFailed] = useState(data.runStatus === "failed")
  const [words, setWords] = useState<TasteWords | null>(data.taste?.words ?? null)
  const [picks, setPicks] = useState<Record<string, StoredPick[]>>(data.taste?.picks ?? {})
  const [bridges, setBridges] = useState(data.taste?.bridges ?? [])
  const [saved, setSaved] = useState(() => new Set(data.saved.map((s) => s.qlooId)))
  const [more, setMore] = useState<{ pick: StoredPick; domain: string } | null>(null)

  const onEvent = useCallback(
    (event: RunEvent) => {
      if (event.type === "words") setWords(event.data.words as TasteWords)
      else if (event.type === "picks")
        setPicks((prev) => ({
          ...prev,
          [event.data.domain as string]: event.data.picks as StoredPick[],
        }))
      else if (event.type === "bridges") setBridges(event.data.bridges as typeof bridges)
      else if (event.type === "status") {
        const status = event.data.status as string
        if (status === "done") {
          setLive(false)
          router.refresh()
        } else if (status === "failed") {
          setLive(false)
          setFailed(true)
        }
      }
    },
    [router],
  )
  useRunEvents(live ? runId : null, onEvent)

  const startRun = (id: string) => {
    setRunId(id)
    setFailed(false)
    setLive(true)
  }

  const domainOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const [domain, list] of Object.entries(picks))
      for (const p of list) map.set(p.qlooId, domain)
    return map
  }, [picks])

  const toggleSave = async (pick: StoredPick) => {
    const isSaved = saved.has(pick.qlooId)
    setSaved((s) => {
      const next = new Set(s)
      if (isSaved) next.delete(pick.qlooId)
      else next.add(pick.qlooId)
      return next
    })
    try {
      await api(`/api/people/${person.id}/saved`, {
        method: isSaved ? "DELETE" : "POST",
        json: isSaved
          ? { qlooId: pick.qlooId }
          : { qlooId: pick.qlooId, type: pick.type, name: pick.name, image: pick.image },
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    }
  }

  const notForMe = async (pick: StoredPick) => {
    const domain = domainOf.get(pick.qlooId)
    const before = domain ? picks[domain] : undefined
    if (domain)
      setPicks((prev) => ({
        ...prev,
        [domain]: (prev[domain] ?? []).filter((p) => p.qlooId !== pick.qlooId),
      }))
    try {
      await api(`/api/people/${person.id}/not-for-me`, { json: { qlooId: pick.qlooId } })
      toast(tp("removed"), {
        action: {
          label: tp("undo"),
          onClick: async () => {
            await api(`/api/people/${person.id}/not-for-me`, {
              method: "DELETE",
              json: { qlooId: pick.qlooId },
            })
            if (domain && before) setPicks((prev) => ({ ...prev, [domain]: before }))
          },
        },
      })
    } catch (e) {
      if (domain && before) setPicks((prev) => ({ ...prev, [domain]: before }))
      toast.error(e instanceof Error ? e.message : "")
    }
  }

  const actionsFor =
    (domain: string) =>
    (pick: StoredPick): PickActions => ({
      saved: saved.has(pick.qlooId),
      onToggleSave: () => toggleSave(pick),
      onMore: () => setMore({ pick, domain }),
      onNotForMe: () => notForMe(pick),
    })

  const wordLabels = {
    aesthetic: t("words.aesthetic"),
    lifestyle: t("words.lifestyle"),
    style: t("words.style"),
    decor: t("words.decor"),
    ambience: t("words.ambience"),
    cuisine: t("words.cuisine"),
    dishes: t("words.dishes"),
  }
  const firstReveal = live && !data.taste?.computedAt

  return (
    <div className="flex flex-col gap-10 pb-16">
      <section className="mx-5 overflow-hidden rounded-card bg-card text-card-foreground shadow-paper md:mx-0">
        <LovesFan identity={data.identity} loves={data.loves} />
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
              {person.isSelf ? t("mine") : t("theirs", { name: person.name })}
            </p>
            <h1 className="font-title text-title-sm">{person.name}</h1>
            {person.city ? (
              <p className="flex items-center gap-1 text-sm text-paper-muted">
                <MapPin className="size-3.5" /> {person.city}
              </p>
            ) : null}
          </div>
          {words ? (
            <TasteWordsView words={words} labels={wordLabels} />
          ) : live ? (
            <p className="flex items-center gap-2 text-sm text-paper-muted">
              <span className="size-2 animate-lime-pulse rounded-full bg-lime-ink" />{" "}
              {t("computing")}
            </p>
          ) : null}
          {bridges.length ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
                {t("bridges")}
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {bridges.slice(0, 4).map((b) => (
                  <li key={`${b.domain}-${b.to}`}>
                    <span className="text-paper-muted">{td(b.domain as "artist")}: </span>
                    {t("bridged", { from: b.from, to: b.to })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
              {t("loves")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {data.loves.map((l) => (
                <LovePill key={l.id} name={l.name} image={l.imageUrl} type={l.type} />
              ))}
              <LovesEditor personId={person.id} loves={data.loves} onChanged={startRun} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/c?for=${person.id}`}
              className="rounded-pill bg-lime px-4 py-2 text-sm font-semibold text-lime-foreground shadow-sticker transition-transform hover:-translate-y-px"
            >
              {person.isSelf ? t("askSelf") : t("askFor", { name: person.name })}
            </Link>
            <button
              type="button"
              onClick={() => void shareLink("person", person.id, t("linkCopied"))}
              className="inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-sm font-semibold text-paper-foreground ring-1 ring-paper-foreground/15 transition-colors hover:bg-paper-foreground/6"
            >
              <Share2 className="size-4" /> {t("share")}
            </button>
            <BuiltOnQloo runId={runId} />
          </div>
        </div>
      </section>

      {live && !firstReveal ? (
        <p className="sticker mx-5 flex w-fit items-center gap-2 px-3.5 py-2 text-xs font-semibold md:mx-0">
          <span className="size-2 animate-lime-pulse rounded-full bg-lime" /> {t("updating")}
        </p>
      ) : null}
      {failed ? (
        <div className="mx-5 flex items-center gap-3 md:mx-0">
          <p className="text-sm text-destructive">{t("failed")}</p>
          <Button
            variant="sticker"
            size="sm"
            onClick={async () =>
              startRun(
                (await api<{ runId: string }>(`/api/people/${person.id}/refresh`, { json: {} }))
                  .runId,
              )
            }
          >
            {t("retry")}
          </Button>
        </div>
      ) : null}

      {TASTE_DOMAINS.map(({ key }) => (
        <PickRail
          key={key}
          title={td(key)}
          picks={picks[key]}
          loading={live}
          emptyText={key === "place" && !person.city ? t("needsCity") : t("empty")}
          actionsFor={actionsFor(key)}
        />
      ))}

      <section className="flex flex-col gap-3 px-5 md:px-0">
        <h2 className="font-title text-xl">{t("saved")}</h2>
        {data.saved.length ? (
          <div className="flex flex-wrap gap-2">
            {data.saved.map((s) => (
              <LovePill key={s.qlooId} name={s.name} image={s.imageUrl} type={s.type} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-3">{t("nothingSaved")}</p>
        )}
      </section>

      <div className="px-5 md:px-0">
        <AboutForm person={person} onRun={startRun} />
      </div>

      <MoreSheet
        personId={person.id}
        seed={more?.pick ?? null}
        domain={more?.domain ?? null}
        onClose={() => setMore(null)}
        actionsFor={actionsFor(more?.domain ?? "brand")}
      />
    </div>
  )
}
