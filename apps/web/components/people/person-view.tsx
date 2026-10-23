"use client"

import { TASTE_DOMAINS } from "@najimi/config"
import type { StoredPick, TasteArea, TasteWords } from "@najimi/db/schema"
import { Button } from "@najimi/ui/components/button"
import { Orb } from "@najimi/ui/components/orb"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import {
  Bookmark,
  MapPin,
  MessageCircle,
  Pencil,
  Play,
  Radio,
  Share2,
  Stamp,
  Store,
  Waypoints,
} from "lucide-react"
import { LayoutGroup, motion } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { useReportScreen } from "@/components/agent/agent-context"
import { useAskAbout } from "@/components/entity/entity-provider"
import { EntitySheet } from "@/components/entity/entity-sheet"
import { MoreSheet } from "@/components/picks/more-sheet"
import type { PickActions } from "@/components/picks/pick-card"
import { BuiltOnQloo } from "@/components/qloo/built-on-qloo"
import { Face } from "@/components/taste/face"
import { useTasteLine, WordPalette } from "@/components/taste/taste-hero"
import { TasteMap } from "@/components/taste/taste-map"
import { YourPeople } from "@/components/taste/your-people"
import { Tip } from "@/components/tip"
import { api } from "@/lib/fetcher"
import { shareLink } from "@/lib/share-link"
import { sound } from "@/lib/sounds"
import { type RunEvent, useRunEvents } from "@/lib/use-run"
import { type EditableLove, LovesEditor } from "./loves-editor"
import { MatchCard } from "./match-card"
import { PersonMenu } from "./person-menu"
import { FollowButton } from "./person-row"
import { ProfileForm } from "./profile-form"
import { Grid, GridTile, KindChips, kindOf, weave } from "./taste-grid"

export type PersonViewData = {
  person: {
    id: string
    name: string
    isSelf: boolean
    city: string | null
    look: string | null
    /** Their taste colours, from their loves' artwork (null until the first reveal). */
    aura: { c1: string; c2: string; c3: string } | null
    /** How friends find them (@juno); null for someone without one yet. */
    username: string | null
    bio?: string | null
    visibility?: "public" | "friends" | "private"
  }
  identity: string
  loves: EditableLove[]
  taste: {
    words: TasteWords | null
    picks: Record<string, StoredPick[]> | null
    bridges: { from: string; to: string; domain: string }[] | null
    areas: TasteArea[] | null
    runId: string | null
    computedAt: string | null
  } | null
  runStatus: string | null
  saved: { qlooId: string; type: string; name: string; imageUrl: string | null }[]
}

const LIVE = new Set(["queued", "running", "waiting"])
type Tab = "taste" | "loves" | "kept"

/**
 * A person's profile (after Sora's and TikTok's profiles, Refero 261b3605, 9d54f8a6, and Airbuds'
 * music identity, cdb87543): their face on their aura, who they are, their taste in one line, the
 * numbers, one clear action; then tabs of artwork, never lists of words. Their taste is computed
 * live (the words land, then each domain's picks), watched over the run's event stream.
 */
/** Someone else's profile, as the viewer sees it. */
export type OtherView = {
  userId: string
  username: string
  relation: { following: boolean; friends: boolean }
  followers: number
  /** The viewer's own face, for the match. */
  me: { name: string; look: string | null; aura: { c1: string; c2: string; c3: string } | null }
}

export function PersonView({ data, other }: { data: PersonViewData; other?: OtherView }) {
  const t = useTranslations("Taste")
  const askAbout = useAskAbout()
  const tp = useTranslations("Pick")
  const ts = useTranslations("Social")
  const router = useRouter()
  const { person } = data
  // Najimi knows whose profile is open ("what would she love?", "plan something for us").
  useReportScreen({
    where: "profile",
    label: other
      ? `${person.name}'s profile${person.username ? ` (@${person.username})` : ""}`
      : "their own profile",
  })
  const [runId, setRunId] = useState(data.taste?.runId ?? null)
  /** Your own profile (editable, live while your taste computes) or someone else's. */
  const mine = !other
  const [live, setLive] = useState(mine && Boolean(data.runStatus && LIVE.has(data.runStatus)))
  const [failed, setFailed] = useState(data.runStatus === "failed")
  const [words, setWords] = useState<TasteWords | null>(data.taste?.words ?? null)
  const [picks, setPicks] = useState<Record<string, StoredPick[]>>(data.taste?.picks ?? {})
  const [bridges, setBridges] = useState(data.taste?.bridges ?? [])
  const [aura, setAura] = useState(person.aura)
  const [areas, setAreas] = useState<TasteArea[]>(data.taste?.areas ?? [])
  const [kept, setKept] = useState(data.saved)
  const [tab, setTab] = useState<Tab>("taste")
  const [kind, setKind] = useState<string | null>(null)
  const [opened, setOpened] = useState<StoredPick | null>(null)
  const [more, setMore] = useState<{ pick: StoredPick; domain: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [wordsOpen, setWordsOpen] = useState(false)
  const line = useTasteLine(words)

  const onEvent = useCallback(
    (event: RunEvent) => {
      // The reveal is heard as well as seen: words land, each domain clicks in, the end rings.
      if (event.type === "words") {
        setWords(event.data.words as TasteWords)
        sound("place")
      } else if (event.type === "picks") {
        sound("tap")
        setPicks((prev) => ({
          ...prev,
          [event.data.domain as string]: event.data.picks as StoredPick[],
        }))
      } else if (event.type === "aura") setAura(event.data.aura as NonNullable<typeof aura>)
      else if (event.type === "areas") setAreas(event.data.areas as TasteArea[])
      else if (event.type === "bridges") setBridges(event.data.bridges as typeof bridges)
      else if (event.type === "status") {
        const status = event.data.status as string
        if (status === "done") {
          sound("promote")
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
  const woven = useMemo(() => weave(picks), [picks])
  const kinds = useMemo(
    () => TASTE_DOMAINS.map((d) => d.key as string).filter((k) => picks[k]?.length),
    [picks],
  )
  const shown = kind ? (picks[kind] ?? []) : woven
  const isKept = (id: string) => kept.some((k) => k.qlooId === id)
  const shareLoves = data.loves.map((l) => ({ qlooId: l.qlooId, name: l.name, image: l.imageUrl }))

  const toggleSave = async (pick: StoredPick) => {
    const was = isKept(pick.qlooId)
    setKept((list) =>
      was
        ? list.filter((k) => k.qlooId !== pick.qlooId)
        : [
            { qlooId: pick.qlooId, type: pick.type, name: pick.name, imageUrl: pick.image },
            ...list,
          ],
    )
    sound(was ? "tap" : "place")
    try {
      await api(`/api/people/${person.id}/saved`, {
        method: was ? "DELETE" : "POST",
        json: was
          ? { qlooId: pick.qlooId }
          : { qlooId: pick.qlooId, type: pick.type, name: pick.name, image: pick.image },
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    }
  }

  const notForMe = async (pick: StoredPick) => {
    setOpened(null)
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
      saved: isKept(pick.qlooId),
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
  const picksCount = Object.values(picks).reduce((n, list) => n + list.length, 0)
  const stats: { key: Tab | "followers"; value: number; label: string }[] = [
    { key: "loves", value: data.loves.length, label: t("statLoves") },
    { key: "taste", value: picksCount, label: t("statPicks") },
    other
      ? { key: "followers", value: other.followers, label: ts("statFollowers") }
      : { key: "kept", value: kept.length, label: t("statKept") },
  ]
  const tabs: { key: Tab; label: string }[] = [
    { key: "taste", label: t("tabTaste") },
    { key: "loves", label: t("tabLoves") },
    { key: "kept", label: t("tabKept") },
  ]
  const round =
    "grid size-11 shrink-0 place-items-center rounded-full bg-card text-foreground transition-colors hover:bg-secondary"

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Who they are. */}
      <section className="relative flex flex-col items-center gap-4 px-5 pt-2 text-center md:px-0">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-16 -z-10 mx-auto h-80 max-w-xl opacity-45 blur-3xl transition-[background] duration-700 dark:opacity-35"
          style={{
            background: `radial-gradient(55% 65% at 25% 35%, ${aura?.c1 ?? "var(--color-aura-1)"}, transparent 70%), radial-gradient(50% 60% at 55% 20%, ${aura?.c2 ?? "var(--color-aura-2)"}, transparent 70%), radial-gradient(45% 55% at 80% 45%, ${aura?.c3 ?? "var(--color-aura-3)"}, transparent 70%)`,
          }}
        />
        <span className="relative grid size-36 place-items-center">
          <Orb size={144} colors={aura ?? undefined} working={live} className="absolute inset-0" />
          <span className="relative">
            <Face look={person.look} name={person.name} size="xl" />
          </span>
        </span>
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-title text-[2.25rem] leading-none md:text-[2.75rem]">
            {person.name}
          </h1>
          <p className="flex items-center gap-3 text-[14px] text-text-3">
            {person.username ? (
              <span className="font-semibold text-text-2">@{person.username}</span>
            ) : null}
            {person.city ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" strokeWidth={1.8} /> {person.city}
              </span>
            ) : null}
          </p>
          {person.bio ? <p className="max-w-sm text-[15px] text-foreground">{person.bio}</p> : null}
        </div>
        {line ? (
          <button
            type="button"
            onClick={() => setWordsOpen(true)}
            className="max-w-md text-[16px] leading-snug text-text-2 transition-colors hover:text-foreground"
          >
            {line}
          </button>
        ) : live ? (
          <p className="flex items-center gap-2 text-[15px] text-text-3">
            <span className="size-2 animate-pulse rounded-full bg-[var(--color-aura-1)]" />
            {t("computing")}
          </p>
        ) : null}
        <dl className="flex items-center gap-8">
          {stats.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => (s.key !== "followers" ? setTab(s.key) : undefined)}
              className="flex flex-col items-center gap-0.5"
            >
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-title text-[22px] leading-none tabular-nums">{s.value}</dd>
              <span className="text-[12px] text-text-3">{s.label}</span>
            </button>
          ))}
        </dl>
        {other ? (
          <div className="flex w-full max-w-sm items-center gap-2">
            <span className="flex flex-1 [&>button]:h-11 [&>button]:w-full [&>button]:justify-center [&>button]:text-[15px]">
              <FollowButton userId={other.userId} initial={other.relation} />
            </span>
            <Tip label={ts("message")}>
              <button
                type="button"
                aria-label={ts("message")}
                onClick={async () => {
                  const { chatId } = await api<{ chatId: string }>("/api/rooms/dm", {
                    json: { username: other.username },
                  })
                  router.push(`/c/${chatId}`)
                }}
                className={round}
              >
                <MessageCircle className="size-4.5" />
              </button>
            </Tip>
            <Tip label={t("share")}>
              <button
                type="button"
                aria-label={t("share")}
                onClick={() => void shareLink("person", person.id, t("linkCopied"))}
                className={round}
              >
                <Share2 className="size-4.5" />
              </button>
            </Tip>
            <PersonMenu userId={other.userId} name={person.name} className={round} />
          </div>
        ) : null}
        {mine ? (
          <div className="flex w-full max-w-sm flex-col gap-5">
            <div className="flex items-center gap-2">
              <Link
                href="/feed"
                className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-pill bg-primary px-5 text-[15px] font-semibold whitespace-nowrap text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Play className="size-4 shrink-0 fill-current" /> {t("playTaste")}
              </Link>
              <Tip label={t("share")}>
                <button
                  type="button"
                  aria-label={t("share")}
                  onClick={() => void shareLink("person", person.id, t("linkCopied"))}
                  className={cn(round, "size-12")}
                >
                  <Share2 className="size-4.5" />
                </button>
              </Tip>
              <Tip label={t("edit")}>
                <button
                  type="button"
                  aria-label={t("edit")}
                  onClick={() => setEditing(true)}
                  className={cn(round, "size-12")}
                >
                  <Pencil className="size-4.5" />
                </button>
              </Tip>
            </div>
            {/* Where your taste goes next: each with its name, never a bare icon. */}
            <nav className="grid grid-cols-5 gap-1">
              {(
                [
                  ["/connect", "feeds", "feeds", <Radio key="i" className="size-5" />],
                  ["/passport", "passport", "passport", <Stamp key="i" className="size-5" />],
                  ["/business", "business", "business", <Store key="i" className="size-5" />],
                  ["/graph", "graph", "graph", <Waypoints key="i" className="size-5" />],
                  ["/c", "askSelf", "najimi", <Orb key="i" size={30} />],
                ] as const
              ).map(([href, full, short, icon]) => (
                <Link
                  key={href}
                  href={href}
                  aria-label={t(full)}
                  title={t(full)}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <span className="grid size-14 place-items-center rounded-[20px] bg-card text-foreground ring-1 ring-white/[0.06] transition-[background-color,transform] duration-200 group-hover:bg-secondary group-active:scale-95">
                    {icon}
                  </span>
                  <span className="text-[12px] font-medium text-text-2 group-hover:text-foreground">
                    {t(`short.${short}`)}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
        {!other && !mine ? (
          <Tip label={t("share")}>
            <button
              type="button"
              aria-label={t("share")}
              onClick={() => void shareLink("person", person.id, t("linkCopied"))}
              className={round}
            >
              <Share2 className="size-4.5" />
            </button>
          </Tip>
        ) : null}
        {live && data.taste?.computedAt ? (
          <p className="text-[13px] text-text-3">{t("updating")}</p>
        ) : null}
        {failed ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive">{t("failed")}</p>
            <Button
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
      </section>

      {other && person.username ? (
        <div className="mx-5 md:mx-0">
          <MatchCard username={other.username} me={other.me} them={person} />
        </div>
      ) : null}

      {person.city && areas.length ? (
        <div className="mx-5 md:mx-0">
          <YourPeople city={person.city} areas={areas} />
        </div>
      ) : null}

      {bridges.length ? (
        <section className="mx-5 rounded-card bg-card p-5 md:mx-0">
          <TasteMap
            person={{ name: person.name, look: person.look }}
            loves={data.loves}
            bridges={bridges}
            picks={picks}
            graphHref={mine ? "/graph" : undefined}
          />
        </section>
      ) : null}

      {/* The tabs. */}
      <section className="flex flex-col gap-4">
        <LayoutGroup id="profile-tabs">
          <div role="tablist" className="mx-5 flex border-b border-border md:mx-0">
            {tabs.map((x) => (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={tab === x.key}
                onClick={() => setTab(x.key)}
                className={cn(
                  "relative flex-1 py-3 text-[15px] font-semibold transition-colors",
                  tab === x.key ? "text-foreground" : "text-text-3 hover:text-text-2",
                )}
              >
                {x.label}
                {tab === x.key ? (
                  <motion.span
                    layoutId="profile-tab"
                    className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-foreground"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </LayoutGroup>

        {tab === "taste" ? (
          <div className="flex flex-col gap-3">
            {kinds.length > 1 ? <KindChips kinds={kinds} value={kind} onChange={setKind} /> : null}
            {shown.length ? (
              <Grid>
                {shown.map((p, i) => (
                  <GridTile
                    key={p.qlooId}
                    index={i}
                    item={{ id: p.qlooId, type: p.type, name: p.name, image: p.image }}
                    onOpen={() => setOpened(p)}
                  />
                ))}
              </Grid>
            ) : live ? (
              <Grid>
                {Array.from({ length: 9 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
                  <span key={i} className="aspect-square animate-pulse bg-card" />
                ))}
              </Grid>
            ) : (
              <p className="px-5 text-sm text-text-3 md:px-0">
                {kind === "place" && !person.city ? t("needsCity") : t("empty")}
              </p>
            )}
          </div>
        ) : null}

        {tab === "loves" ? (
          <div className="flex flex-col gap-3">
            <Grid>
              {data.loves.map((l, i) => (
                <GridTile
                  key={l.id}
                  index={i}
                  item={{ id: l.qlooId, type: l.type, name: l.name, image: l.imageUrl }}
                  onOpen={() => setTab("loves")}
                />
              ))}
            </Grid>
            {mine ? (
              <div className="px-5 md:px-0">
                <LovesEditor personId={person.id} loves={data.loves} onChanged={startRun} />
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "kept" ? (
          kept.length ? (
            <Grid>
              {kept.map((k, i) => (
                <GridTile
                  key={k.qlooId}
                  index={i}
                  item={{ id: k.qlooId, type: k.type, name: k.name, image: k.imageUrl }}
                  onOpen={() => {
                    const pick = Object.values(picks)
                      .flat()
                      .find((p) => p.qlooId === k.qlooId)
                    if (pick) setOpened(pick)
                  }}
                />
              ))}
            </Grid>
          ) : (
            <div className="mx-5 flex flex-col items-center gap-4 rounded-card bg-card px-6 py-10 text-center md:mx-0">
              <span className="relative grid size-16 place-items-center rounded-full bg-secondary">
                <Bookmark className="size-7" />
              </span>
              <p className="max-w-xs text-[15px] text-text-2">{t("keptEmpty")}</p>
              <Link
                href="/feed"
                className="inline-flex h-10 items-center gap-2 rounded-pill bg-primary px-5 text-[14px] font-semibold text-primary-foreground"
              >
                <Play className="size-4 fill-current" /> {t("keptCta")}
              </Link>
            </div>
          )
        ) : null}
      </section>

      <div className="flex justify-center px-5 md:px-0">
        <BuiltOnQloo runId={runId} />
      </div>

      <EntitySheet
        thing={opened}
        loves={shareLoves}
        onClose={() => setOpened(null)}
        actions={
          mine && opened
            ? {
                saved: isKept(opened.qlooId),
                onToggleSave: () => void toggleSave(opened),
                onMore: () => {
                  setMore({
                    pick: opened,
                    domain: domainOf.get(opened.qlooId) ?? kindOf(opened.type),
                  })
                  setOpened(null)
                },
                onAsk: () => {
                  setOpened(null)
                  askAbout(opened)
                },
                onNotForMe: () => void notForMe(opened),
              }
            : {}
        }
      />
      <MoreSheet
        personId={person.id}
        seed={more?.pick ?? null}
        domain={more?.domain ?? null}
        onClose={() => setMore(null)}
        actionsFor={actionsFor(more?.domain ?? "brand")}
      />

      {/* Their taste in Qloo's words, all of them, a tap away from the line. */}
      <Sheet open={wordsOpen} onOpenChange={setWordsOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="font-title pt-5 text-[1.75rem] font-normal">
            {t("madeOf")}
          </SheetTitle>
          {words ? <WordPalette words={words} labels={wordLabels} /> : null}
        </SheetContent>
      </Sheet>

      {/* Edit: where they are (more fields arrive with friends and circles). */}
      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="font-title pt-5 text-[1.75rem] font-normal">
            {t("edit")}
          </SheetTitle>
          <div className="pt-2">
            <ProfileForm
              person={{
                id: person.id,
                name: person.name,
                city: person.city,
                bio: person.bio ?? null,
                visibility: person.visibility ?? "public",
              }}
              onRun={(id) => {
                startRun(id)
                setEditing(false)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
