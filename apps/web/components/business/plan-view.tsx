"use client"

import type { BusinessMove, BusinessReport, BusinessThing } from "@najimi/db/schema"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronRight,
  Copy,
  Handshake,
  Loader2,
  MapPin,
  Moon,
  Music,
  Package,
  Pause,
  Play,
  Send,
  Share2,
  Sofa,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wrench,
} from "lucide-react"
import { LayoutGroup, motion } from "motion/react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { siX } from "simple-icons"
import { useAgent } from "@/components/agent/agent-context"
import { BrandIcon } from "@/components/brands/brand-icon"
import { qlooTag } from "@/components/brands/qloo-logo"
import { sized } from "@/components/connect/platforms"
import { SITES } from "@/components/entity/entity-links"
import { OpenThing, useEntity } from "@/components/entity/entity-provider"
import { DarkSheet } from "@/components/feed/dark-sheet"
import { type Track, usePlayer } from "@/components/player/player"
import { movesOf } from "@/lib/business-moves"
import type { EntityDetails, Site } from "@/lib/entity"
import { api } from "@/lib/fetcher"

/*
 * A business's plan (W19), read in one screen: who its people are in one card (a sentence, the
 * things they love as faces, who · where · what's rising), then this week's three moves, each a
 * short title with the faces it stands on and one thing to do next (post it, invite the partner,
 * plan it with Najimi, play the set). The rest sits behind tabs: what its people love and how
 * they differ from the street, the places (the city map, comparables, partners, what's rising),
 * and posts to try. Every thing opens its own sheet. Shared as is, without the owner's actions.
 */

const BusinessMap = dynamic(() => import("./business-map").then((m) => m.BusinessMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-white/5" />,
})

const KIND_ICON: Record<BusinessMove["kind"], typeof Music> = {
  menu: UtensilsCrossed,
  music: Music,
  night: Moon,
  stock: Package,
  partner: Handshake,
  space: Sofa,
  service: Wrench,
}
const NEXT_ICON: Record<BusinessMove["next"]["type"], typeof Music> = {
  post: Send,
  invite: Handshake,
  plan: Sparkles,
  play: Play,
}
const KINDS = [
  ["urn:entity:artist", "music"],
  ["urn:entity:brand", "brands"],
  ["urn:entity:place", "places"],
  ["urn:entity:movie", "film"],
  ["urn:entity:tv_show", "tv"],
  ["urn:entity:book", "books"],
  ["urn:entity:podcast", "podcasts"],
] as const
/** Where an invite goes first: the partner's own account, then its site. */
const REACH: Site[] = ["instagram", "x", "tiktok", "facebook"]

type Tab = "week" | "people" | "places" | "posts"

export type PlanBusiness = {
  id: string
  name: string
  kind: string
  city: string | null
  lat: number | null
  lon: number | null
  report: BusinessReport
}

/** The lean as a few readable words: the age band most over-represented, and gender. */
function leanWords(lean: BusinessReport["lean"]) {
  if (!lean) return null
  const age = Object.entries(lean.age).sort((a, b) => b[1] - a[1])[0]
  const gender = Object.entries(lean.gender).sort((a, b) => b[1] - a[1])[0]
  const band = age?.[0]
    .replace("_to_", "–")
    .replace("24_and_younger", "under 25")
    .replace("55_and_older", "55+")
  return { band: band ?? null, gender: gender && gender[1] > 0.15 ? gender[0] : null }
}

function Face({
  thing,
  size,
  ring = "ring-background",
}: {
  thing: BusinessThing
  size: number
  ring?: string
}) {
  return thing.image ? (
    // biome-ignore lint/performance/noImgElement: remote artwork
    <img
      src={sized(thing.image, size * 2) ?? ""}
      alt={thing.name}
      title={thing.name}
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded-full object-cover ring-2", ring)}
    />
  ) : (
    <span
      title={thing.name}
      style={{ width: size, height: size }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold ring-2",
        ring,
      )}
    >
      {thing.name.slice(0, 1)}
    </span>
  )
}

/** A thing's face; a tap opens it (the plan's fans, partners and street are all things). */
function Art({ thing, size = 40, ring }: { thing: BusinessThing; size?: number; ring?: string }) {
  return (
    <OpenThing thing={thing} surface="business" className="shrink-0 rounded-full">
      <Face thing={thing} size={size} ring={ring} />
    </OpenThing>
  )
}

/** A thing as a row: face, name (opens it), a line under it, and whatever sits at the end. */
function ThingRow({
  thing,
  line,
  end,
}: {
  thing: BusinessThing
  line?: string | null
  end?: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Art thing={thing} size={40} ring="ring-card" />
      <span className="flex min-w-0 flex-1 flex-col">
        <OpenThing thing={thing} surface="business" chevron className="max-w-full">
          <span className="truncate text-[15px] font-semibold">{thing.name}</span>
        </OpenThing>
        {line ? <span className="line-clamp-2 text-[13px] text-text-3">{line}</span> : null}
      </span>
      {end}
    </li>
  )
}

function Rows({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-1 text-[13px] font-semibold text-text-3">{title}</h3>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card bg-card ring-1 ring-border">
        {children}
      </ul>
    </section>
  )
}

export function PlanView({
  business,
  actions,
  owner = false,
  shareToken = null,
}: {
  business: PlanBusiness
  /** The owner's buttons (share, build again, ask Najimi), beside the name. */
  actions?: ReactNode
  /** The owner sees each move's action; a shared page shows the plan only. */
  owner?: boolean
  /** On a shared page, the link's token (a move's set plays from it). */
  shareToken?: string | null
}) {
  const t = useTranslations("Business")
  const r = business.report
  const all = new Map<string, BusinessThing>()
  for (const list of [
    ...Object.values(r.fans),
    r.comparables,
    r.match ? [r.match] : [],
    r.scene?.artists ?? [],
    r.scene?.brands ?? [],
    r.scene?.places ?? [],
    r.rising,
  ])
    for (const i of list) all.set(i.qlooId, i)
  const moves = r.plan ? movesOf(r.plan, business.name) : []
  const posts = r.plan?.posts ?? []
  const tabs = (
    [
      ["week", moves.length > 0],
      ["people", Object.keys(r.fans).length > 0],
      ["places", true],
      ["posts", posts.length > 0],
    ] as const
  ).flatMap(([key, shown]) => (shown ? [key] : []))
  const [tab, setTab] = useState<Tab>(tabs[0] ?? "places")
  const [opened, setOpened] = useState<number | null>(null)

  return (
    <article className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-title text-[1.9rem] leading-none">{business.name}</h1>
          <span className="text-[14px] text-text-3">
            {[business.kind, business.city].filter(Boolean).join(" · ")}
          </span>
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </header>

      <PeopleCard report={r} onChip={setTab} />

      <div className="flex flex-col gap-3">
        <LayoutGroup id="business-tabs">
          <div role="tablist" className="flex border-b border-border">
            {tabs.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "relative flex-1 py-2.5 text-[15px] font-semibold transition-colors",
                  tab === key ? "text-foreground" : "text-text-3 hover:text-text-2",
                )}
              >
                {t(`tab.${key}`)}
                {tab === key ? (
                  <motion.span
                    layoutId="business-tab"
                    className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-foreground"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </LayoutGroup>

        {tab === "week" ? (
          <ul className="flex flex-col gap-2.5">
            {moves.map((move, i) => (
              <li key={move.title}>
                <MoveCard move={move} all={all} owner={owner} onOpen={() => setOpened(i)} />
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "people" ? <PeopleTab business={business} /> : null}
        {tab === "places" ? <PlacesTab business={business} all={all} /> : null}
        {tab === "posts" ? (
          <ul className="flex flex-col gap-3">
            {posts.map((post) => (
              <li
                key={post}
                className="flex flex-col gap-3 rounded-card bg-card p-4 ring-1 ring-border"
              >
                <p className="text-[15px] leading-relaxed">{post}</p>
                <PostButtons text={post} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <footer className="flex items-center justify-between border-t border-border pt-4 text-[12px] text-text-3">
        <span>
          {t.rich("builtOn", { ...qlooTag("mx-0.5 text-text-2"), count: r.calls.length })}
        </span>
        <time dateTime={r.builtAt} suppressHydrationWarning>
          {new Date(r.builtAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </time>
      </footer>

      <MoveSheet
        business={business}
        move={opened == null ? null : (moves[opened] ?? null)}
        index={opened ?? 0}
        all={all}
        owner={owner}
        shareToken={shareToken}
        onClose={() => setOpened(null)}
      />
    </article>
  )
}

/** Who its people are, in one card: a sentence, their loves as faces, who · where · rising. */
function PeopleCard({ report: r, onChip }: { report: BusinessReport; onChip: (tab: Tab) => void }) {
  const t = useTranslations("Business")
  const lean = leanWords(r.lean)
  const faces = KINDS.flatMap(([type]) => r.fans[type]?.slice(0, 1) ?? [])
    .concat(KINDS.flatMap(([type]) => r.fans[type]?.slice(1, 2) ?? []))
    .slice(0, 7)
  const rising = r.rising[0]
  // Plans written before moves had a longer read: its first sentence says who the people are.
  const summary = r.plan?.moves
    ? r.plan.summary
    : (r.plan?.summary.split(/(?<=[.!?])\s/)[0] ?? null)
  const chips = [
    lean?.band
      ? {
          icon: Users,
          label: `${lean.band}${lean.gender ? ` · ${t(`gender.${lean.gender}` as "gender.male")}` : ""}`,
          tab: "people" as const,
        }
      : null,
    r.areas[0] ? { icon: MapPin, label: r.areas[0].name, tab: "places" as const } : null,
    rising
      ? {
          icon: TrendingUp,
          label: `${rising.name} +${rising.growth.toFixed(1)}`,
          tab: "places" as const,
        }
      : null,
  ].filter((c) => c != null)
  return (
    <section className="relative isolate overflow-hidden rounded-sheet bg-card p-4 ring-1 ring-border">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 80% at 0% 0%, color-mix(in oklab, var(--color-aura-1) 26%, transparent), transparent 70%), radial-gradient(50% 70% at 100% 10%, color-mix(in oklab, var(--color-aura-2) 22%, transparent), transparent 70%)",
        }}
      />
      <span className="text-[12px] font-bold tracking-[0.08em] text-text-3 uppercase">
        {t("yourPeople")}
      </span>
      {summary ? (
        <p className="mt-1.5 line-clamp-3 font-heading text-[17px] leading-snug">{summary}</p>
      ) : null}
      {faces.length ? (
        <div className="mt-3 flex -space-x-2">
          {faces.map((f) => (
            <Art key={f.qlooId} thing={f} size={34} ring="ring-card" />
          ))}
        </div>
      ) : null}
      {chips.length ? (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onChip(c.tab)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-pill bg-background/70 px-3 text-[13px] font-semibold whitespace-nowrap ring-1 ring-border backdrop-blur"
            >
              <c.icon className="size-3.5 shrink-0 text-text-3" />
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/** A move at a glance: its kind, the move in a line, the faces it stands on, what's next. */
function MoveCard({
  move,
  all,
  owner,
  onOpen,
}: {
  move: BusinessMove
  all: Map<string, BusinessThing>
  /** Only the owner gets the next step; anyone can play a set. */
  owner: boolean
  onOpen: () => void
}) {
  const t = useTranslations("Business")
  const Icon = KIND_ICON[move.kind]
  const Next = NEXT_ICON[move.next.type]
  const evidence = move.evidence.flatMap((id) => all.get(id) ?? [])
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3.5 rounded-card bg-card p-3.5 text-start ring-1 ring-border transition-colors hover:ring-[var(--color-line-strong)]"
    >
      <span className="relative h-11 w-[3.25rem] shrink-0">
        {evidence.slice(0, 2).map((e, i) => (
          <span
            key={e.qlooId}
            className={cn("absolute top-0", i === 0 ? "start-0 z-10" : "start-3.5 top-1.5")}
          >
            <Face thing={e} size={i === 0 ? 38 : 34} ring="ring-card" />
          </span>
        ))}
        {evidence.length ? null : (
          <span className="grid size-11 place-items-center rounded-full bg-secondary">
            <Icon className="size-5" />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3">
          <Icon className="size-3.5" />
          {t(`moveKind.${move.kind}`)}
        </span>
        <span className="line-clamp-2 font-heading text-[16px] leading-snug">{move.title}</span>
        {owner || move.next.type === "play" ? (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
            <Next className="size-3.5" />
            {t(`next.${move.next.type}`)}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-text-3 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

/** A move opened: why, what it stands on, and the one thing to do next. */
function MoveSheet({
  business,
  move,
  index,
  all,
  owner,
  shareToken,
  onClose,
}: {
  business: PlanBusiness
  move: BusinessMove | null
  index: number
  all: Map<string, BusinessThing>
  owner: boolean
  shareToken: string | null
  onClose: () => void
}) {
  const t = useTranslations("Business")
  const [shown, setShown] = useState(move)
  if (move && move !== shown) setShown(move)
  const m = move ?? shown
  const evidence = m ? m.evidence.flatMap((id) => all.get(id) ?? []) : []
  const Icon = m ? KIND_ICON[m.kind] : Music
  return (
    <DarkSheet
      open={move != null}
      onOpenChange={(open) => !open && onClose()}
      title={m?.title ?? ""}
      bare
    >
      {m ? (
        <div className="flex flex-col gap-5 px-5 pt-8">
          <div className="flex flex-col gap-2 pe-10">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-white/55">
              <Icon className="size-4" />
              {t(`moveKind.${m.kind}`)}
            </span>
            <h2 className="font-title text-[26px] leading-tight">{m.title}</h2>
            <p className="text-[15px] leading-relaxed text-white/70">{m.why}</p>
          </div>
          {evidence.length ? (
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold text-white/45">{t("standsOn")}</span>
              <ul className="flex flex-wrap gap-2">
                {evidence.map((e) => (
                  <li key={e.qlooId}>
                    <OpenThing
                      thing={e}
                      surface="business"
                      className="flex h-10 items-center gap-2 rounded-pill bg-white/8 ps-1 pe-3.5"
                    >
                      <Face thing={e} size={32} ring="ring-transparent" />
                      <span className="max-w-[11rem] truncate text-[13px] font-semibold">
                        {e.name}
                      </span>
                    </OpenThing>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {m.next.type === "play" ? (
            <PlaySet businessId={business.id} index={index} shareToken={shareToken} />
          ) : owner ? (
            <NextStep move={m} all={all} onDone={onClose} />
          ) : null}
        </div>
      ) : null}
    </DarkSheet>
  )
}

/** The draft the move comes with: the post, the message, or what Najimi is asked to plan. */
function Draft({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-tile bg-white/6 p-4 ring-1 ring-white/10">
      <span className="text-[12px] font-semibold text-white/45">{label}</span>
      <p className="text-[15px] leading-relaxed">{text}</p>
    </div>
  )
}

const primary =
  "flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-white font-heading text-[15px] text-black"
const quiet =
  "flex h-11 w-full items-center justify-center gap-1.5 rounded-pill bg-white/10 text-[14px] font-semibold"

function NextStep({
  move,
  all,
  onDone,
}: {
  move: BusinessMove
  all: Map<string, BusinessThing>
  onDone: () => void
}) {
  const t = useTranslations("Business")
  const agent = useAgent()
  if (move.next.type === "post")
    return (
      <div className="flex flex-col gap-3">
        <Draft label={t("draft.post")} text={move.next.text} />
        <PostButtons text={move.next.text} dark />
      </div>
    )
  if (move.next.type === "invite") {
    const partner = move.next.partner ? all.get(move.next.partner) : null
    return partner ? <Invite partner={partner} text={move.next.text} /> : null
  }
  return (
    <div className="flex flex-col gap-3">
      <Draft label={t("draft.plan")} text={move.next.text} />
      <button
        type="button"
        className={primary}
        onClick={() => {
          onDone()
          agent.ask(move.next.text)
        }}
      >
        <Sparkles className="size-4" /> {t("planWithNajimi")}
      </button>
    </div>
  )
}

/** Invite the partner: copy the message, then open where they are (their account, or site). */
function Invite({ partner, text }: { partner: BusinessThing; text: string }) {
  const t = useTranslations("Business")
  const entity = useEntity()
  const details = useQuery({
    queryKey: ["entity", partner.qlooId],
    queryFn: () => api<EntityDetails>(`/api/entities/${partner.qlooId}`),
    staleTime: 10 * 60_000,
  })
  const d = details.data
  const account = REACH.flatMap((site) => d?.follow.find((l) => l.site === site) ?? [])[0]
  const site = d?.place?.website ?? d?.links.website ?? null
  const where = account
    ? { url: account.url, label: SITES[account.site].label ?? account.site }
    : site
      ? { url: site, label: t("theirSite") }
      : null
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => undefined)
  }
  return (
    <div className="flex flex-col gap-3">
      {text ? <Draft label={t("draft.invite", { name: partner.name })} text={text} /> : null}
      {details.isPending ? (
        <span className={cn(primary, "opacity-60")}>
          <Loader2 className="size-4 animate-spin" />
        </span>
      ) : where ? (
        <a
          href={where.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            if (!text) return
            void copy()
            toast(t("inviteCopied", { where: where.label }))
          }}
          className={primary}
        >
          <Handshake className="size-4" />
          {text ? t("inviteVia", { where: where.label }) : t("openOn", { where: where.label })}
        </a>
      ) : (
        <button
          type="button"
          className={primary}
          onClick={() => entity.open(partner, { surface: "business" })}
        >
          <Handshake className="size-4" /> {t("openThing", { name: partner.name })}
        </button>
      )}
      {text && where ? (
        <button
          type="button"
          className={quiet}
          onClick={() => {
            void copy()
            toast(t("copied"))
          }}
        >
          <Copy className="size-4" /> {t("copy")}
        </button>
      ) : null}
    </div>
  )
}

/** The move's set: its artists' songs through the one player, so it keeps playing on any screen. */
function PlaySet({
  businessId,
  index,
  shareToken,
}: {
  businessId: string
  index: number
  shareToken: string | null
}) {
  const t = useTranslations("Business")
  const player = usePlayer()
  const set = useQuery({
    queryKey: ["business-set", businessId, index],
    queryFn: () =>
      api<{ tracks: (Omit<Track, "source"> & { store: string })[] }>(
        `/api/businesses/${businessId}/set?move=${index}${shareToken ? `&token=${shareToken}` : ""}`,
      ),
    staleTime: 10 * 60_000,
  })
  const list: Track[] = (set.data?.tracks ?? []).map((tr) => ({ ...tr, source: "apple" }))
  const mine = list.some((tr) => tr.id === player.track?.id)
  const playing = mine && player.playing
  if (set.isSuccess && !list.length) return null
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={!list.length}
        className={cn(primary, "disabled:opacity-60")}
        onClick={() => {
          if (mine) player.toggle()
          else if (list[0]) void player.play(list[0], list)
        }}
      >
        {set.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : playing ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="size-4 fill-current" />
        )}
        {playing ? t("pauseSet") : t("playSet")}
      </button>
      {list.length ? (
        <span className="text-center text-[12px] text-white/45">
          {t("setOf", {
            count: list.length,
            names: [...new Set(list.map((tr) => tr.by))].slice(0, 3).join(" · "),
          })}
        </span>
      ) : null}
    </div>
  )
}

/** Post it on X (prefilled), share it anywhere, or copy it. */
function PostButtons({ text, dark = false }: { text: string; dark?: boolean }) {
  const t = useTranslations("Business")
  return (
    <div className="flex gap-2">
      <a
        href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-pill px-4 text-[13px] font-semibold",
          dark ? "bg-white text-black" : "bg-foreground text-background",
        )}
      >
        <BrandIcon icon={siX} className="size-3" /> {t("postOnX")}
      </a>
      <button
        type="button"
        onClick={async () => {
          if (navigator.share) await navigator.share({ text }).catch(() => undefined)
          else {
            await navigator.clipboard.writeText(text).catch(() => undefined)
            toast(t("copied"))
          }
        }}
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-pill px-3.5 text-[13px] font-semibold",
          dark ? "bg-white/10" : "bg-secondary",
        )}
      >
        <Share2 className="size-3.5" /> {t("share")}
      </button>
      <button
        type="button"
        aria-label={t("copy")}
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => undefined)
          toast(t("copied"))
        }}
        className={cn(
          "grid size-10 place-items-center rounded-full",
          dark ? "bg-white/10" : "bg-secondary",
        )}
      >
        <Copy className="size-4" />
      </button>
    </div>
  )
}

/** What its people love by kind, their words and lean, and how they differ from the street. */
function PeopleTab({ business }: { business: PlanBusiness }) {
  const t = useTranslations("Business")
  const r = business.report
  const kinds = KINDS.filter(([type]) => r.fans[type]?.length)
  const [kind, setKind] = useState<string>(kinds[0]?.[0] ?? "")
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
          {kinds.map(([type, key]) => (
            <button
              key={type}
              type="button"
              aria-pressed={kind === type}
              onClick={() => setKind(type)}
              className={cn(
                "h-9 shrink-0 rounded-pill px-3.5 text-[13px] font-semibold transition-colors",
                kind === type
                  ? "bg-foreground text-background"
                  : "bg-card text-text-2 ring-1 ring-border",
              )}
            >
              {t(`kind.${key}`)}
            </button>
          ))}
        </div>
        <ul className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:scroll-px-0 md:px-0">
          {(r.fans[kind] ?? []).map((item) => (
            <li key={item.qlooId} className="w-32 shrink-0 snap-start">
              <OpenThing
                thing={item}
                surface="business"
                className="flex w-full flex-col gap-1.5 rounded-tile"
              >
                {item.image ? (
                  // biome-ignore lint/performance/noImgElement: remote artwork
                  <img
                    src={sized(item.image, 320) ?? ""}
                    alt=""
                    className="aspect-square w-full rounded-tile object-cover"
                  />
                ) : (
                  <span className="aspect-square w-full rounded-tile bg-secondary" />
                )}
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
                  {item.name}
                </span>
                {item.caption ? (
                  <span className="truncate text-[11px] text-text-3">{item.caption}</span>
                ) : null}
              </OpenThing>
            </li>
          ))}
        </ul>
      </section>

      {r.words.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-[13px] font-semibold text-text-3">{t("theirWords")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {r.words.slice(0, 10).map((w) => (
              <span
                key={w.name}
                className="rounded-pill bg-card px-2.5 py-1 text-[12px] font-semibold text-text-2 ring-1 ring-border"
              >
                {w.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {r.compare ? (
        <section className="flex flex-col gap-3">
          <h3 className="px-1 text-[13px] font-semibold text-text-3">
            {t("street", { area: r.scene?.area ?? business.city ?? "" })}
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                k: t("onlyFans"),
                list: r.compare.theirsOnly,
                tone: "bg-foreground text-background",
              },
              { k: t("both"), list: r.compare.shared, tone: "bg-secondary text-foreground" },
              {
                k: t("onlyStreet"),
                list: r.compare.sceneOnly,
                tone: "bg-card text-text-3 ring-1 ring-border",
              },
            ].map((col) => (
              <div key={col.k} className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold text-text-3">{col.k}</span>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(col.list)].slice(0, 6).map((w) => (
                    <span
                      key={w}
                      className={cn("rounded-pill px-2.5 py-1 text-[12px] font-semibold", col.tone)}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

/** The city with its people rising out of it, then every place the plan names, each openable. */
function PlacesTab({ business, all }: { business: PlanBusiness; all: Map<string, BusinessThing> }) {
  const t = useTranslations("Business")
  const r = business.report
  const centre =
    business.lat != null && business.lon != null ? { lat: business.lat, lon: business.lon } : null
  const partners = (r.plan?.partners ?? []).flatMap((p) => {
    const found = all.get(p.qlooId)
    return found ? [{ thing: found, why: p.why }] : []
  })
  const targets = new Map((r.plan?.targets ?? []).map((tg) => [tg.area.toLowerCase(), tg.why]))
  return (
    <div className="flex flex-col gap-6">
      <div className="dark relative overflow-hidden rounded-card text-foreground ring-1 ring-border">
        <BusinessMap
          name={business.name}
          centre={centre}
          cells={r.cells}
          areas={r.areas.slice(0, 4)}
          className="h-[300px] w-full bg-[#07060c]"
        />
      </div>
      {r.areas.length ? (
        <Rows title={t("clusters")}>
          {r.areas.slice(0, 4).map((a) => (
            <li key={a.name} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary">
                <MapPin className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{a.name}</span>
                {targets.get(a.name.toLowerCase()) ? (
                  <span className="line-clamp-2 text-[13px] text-text-3">
                    {targets.get(a.name.toLowerCase())}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </Rows>
      ) : null}
      {r.match ? (
        <Rows title={t("yours")}>
          <ThingRow thing={r.match} line={r.match.caption} />
        </Rows>
      ) : r.comparables.length ? (
        <Rows title={t("likeYours")}>
          {r.comparables.slice(0, 5).map((c) => (
            <ThingRow key={c.qlooId} thing={c} line={c.caption} />
          ))}
        </Rows>
      ) : null}
      {partners.length ? (
        <Rows title={t("partners")}>
          {partners.map((p) => (
            <ThingRow key={p.thing.qlooId} thing={p.thing} line={p.why} />
          ))}
        </Rows>
      ) : null}
      {r.rising.length ? (
        <Rows title={t("rising")}>
          {r.rising.map((p) => (
            <ThingRow
              key={p.qlooId}
              thing={p}
              line={p.caption}
              end={
                <span className="flex items-center gap-1 text-[13px] font-bold text-success tabular-nums">
                  <TrendingUp className="size-4" />+{p.growth.toFixed(1)}
                </span>
              }
            />
          ))}
        </Rows>
      ) : null}
      {r.scene?.places.length ? (
        <Rows title={t("aroundYou")}>
          {r.scene.places.slice(0, 5).map((p) => (
            <ThingRow key={p.qlooId} thing={p} line={p.caption} />
          ))}
        </Rows>
      ) : null}
    </div>
  )
}
