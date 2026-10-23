"use client"

import type { ConnectionView } from "@najimi/connectors/sessions"
import { toast } from "@najimi/ui/components/sonner"
import { Switch } from "@najimi/ui/components/switch"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowUpRight,
  BellRing,
  Briefcase,
  CalendarCheck,
  Copy,
  Dices,
  FileDown,
  Heart,
  Loader2,
  type LucideIcon,
  Pause,
  PenLine,
  Play,
  Sunrise,
  UserPlus,
} from "lucide-react"
import Link from "next/link"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { siInstagram, siX } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { zone } from "@/components/connect/platforms"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"

/*
 * Your agents: one card per account you connected, with its three agents (follow, like, post),
 * what each does and when, a switch, what it did lately and the post waiting for your yes; pause
 * them all for a day. Below, the routines Najimi runs for you inside the app.
 */

type Action = {
  id: string
  platform: string
  kind: "follow" | "like" | "post"
  label: string
  status: "done" | "failed" | "skipped"
  detail: string | null
  url: string | null
  at: string
}
type Draft = {
  id: string
  platform: "x" | "instagram"
  text: string
  status: "ready" | "posted" | "skipped" | "failed"
  url: string | null
  detail: string | null
  at: string
}
type Summary = {
  connections: ConnectionView[]
  actions: Action[]
  drafts: Draft[]
  routines: {
    tuneUp: string | null
    circles: number
    businesses: number
    businessesChecked: string | null
    bookings: number
    downloads: { platform: string; readyAt: string }[]
  }
}

const BRAND = { x: { icon: siX, name: "X" }, instagram: { icon: siInstagram, name: "Instagram" } }
const KIND_ICON: Record<"follow" | "like" | "post", LucideIcon> = {
  follow: UserPlus,
  like: Heart,
  post: PenLine,
}

function Recent({ actions }: { actions: Action[] }) {
  const format = useFormatter()
  const now = new Date()
  if (!actions.length) return null
  return (
    <ul className="flex flex-col gap-1.5 ps-11">
      {actions.slice(0, 3).map((a) => (
        <li key={a.id} className="flex items-center gap-2 text-[13px]">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              a.status === "done" ? "bg-success" : "bg-destructive",
            )}
          />
          {a.url ? (
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 truncate font-semibold hover:underline"
            >
              {a.label}
            </a>
          ) : (
            <span className="min-w-0 truncate font-semibold">{a.label}</span>
          )}
          <span className="shrink-0 text-text-3" suppressHydrationWarning>
            {a.status === "done"
              ? format.relativeTime(new Date(Math.min(Date.parse(a.at), now.getTime())), now)
              : a.detail}
          </span>
        </li>
      ))}
    </ul>
  )
}

function DraftCard({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const t = useTranslations("Agents")
  const [text, setText] = useState(draft.text)
  const [busy, setBusy] = useState<"post" | "skip" | null>(null)
  const act = async (action: "post" | "skip") => {
    setBusy(action)
    try {
      await api(`/api/agents/drafts/${draft.id}`, {
        json: { action, ...(text !== draft.text ? { text } : {}) },
      })
      if (action === "post") {
        sound("promote")
        toast(t("posted"))
      }
      onDone()
    } catch (e) {
      toast(e instanceof Error ? e.message : t("failed"))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="ms-11 flex flex-col gap-2.5 rounded-tile bg-background p-3 ring-1 ring-border">
      <span className="text-[12px] font-semibold text-text-3">{t("draftReady")}</span>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={280}
        rows={3}
        aria-label={t("draftReady")}
        className="resize-none bg-transparent text-[14px] leading-relaxed outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {draft.platform === "x" ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void act("post")}
            className="flex h-9 items-center gap-1.5 rounded-pill bg-foreground px-3.5 text-[13px] font-semibold text-background disabled:opacity-60"
          >
            {busy === "post" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <BrandIcon icon={siX} className="size-3" />
            )}
            {t("postIt")}
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(text).catch(() => undefined)
              toast(t("copied"))
            }}
            className="flex h-9 items-center gap-1.5 rounded-pill bg-foreground px-3.5 text-[13px] font-semibold text-background"
          >
            <Copy className="size-3.5" /> {t("copyForInstagram")}
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void act("skip")}
          className="flex h-9 items-center rounded-pill bg-secondary px-3.5 text-[13px] font-semibold disabled:opacity-60"
        >
          {t("skip")}
        </button>
      </div>
    </div>
  )
}

function AccountCard({
  connection: c,
  actions,
  drafts,
  refresh,
}: {
  connection: ConnectionView
  actions: Action[]
  drafts: Draft[]
  refresh: () => Promise<unknown>
}) {
  const t = useTranslations("Agents")
  const format = useFormatter()
  const platform = c.platform as "x" | "instagram"
  const brand = BRAND[platform]
  const [busy, setBusy] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const active = c.status === "active"
  const paused = Boolean(c.pausedUntil)

  const change = async (key: string, json: Record<string, unknown>) => {
    setBusy(key)
    try {
      await api(`/api/socials/${platform}`, { method: "PATCH", json: { ...json, tz: zone() } })
      sound("tap")
      await refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : t("failed"))
    } finally {
      setBusy(null)
    }
  }
  const write = async () => {
    setWriting(true)
    try {
      await api("/api/agents/drafts", { json: { platform } })
      await refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : t("failed"))
    } finally {
      setWriting(false)
    }
  }

  const rows = [
    { kind: "follow" as const, on: c.autopilot, key: "autopilot" },
    { kind: "like" as const, on: c.likes, key: "likes" },
  ]
  const ready = drafts.filter((d) => d.platform === platform && d.status === "ready")

  return (
    <section className="flex flex-col gap-4 rounded-card bg-card p-4 ring-1 ring-border">
      <header className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white">
          <BrandIcon icon={brand.icon} colored className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-heading text-[16px]">{brand.name}</span>
          <span className="truncate text-[13px] text-text-3">
            {c.handle ? `@${c.handle}` : ""}
            {!active
              ? ` · ${t("reconnect")}`
              : paused
                ? ` · ${t("pausedUntil", { when: format.dateTime(new Date(c.pausedUntil ?? ""), { weekday: "short", hour: "numeric", minute: "2-digit" }) })}`
                : ""}
          </span>
        </span>
        {active ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void change("paused", { paused: !paused })}
            className="flex h-9 items-center gap-1.5 rounded-pill bg-secondary px-3 text-[13px] font-semibold disabled:opacity-60"
          >
            {busy === "paused" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : paused ? (
              <Play className="size-3.5" />
            ) : (
              <Pause className="size-3.5" />
            )}
            {paused ? t("resume") : t("pauseDay")}
          </button>
        ) : (
          <Link
            href="/connect"
            className="flex h-9 items-center rounded-pill bg-foreground px-3 text-[13px] font-semibold text-background"
          >
            {t("reconnect")}
          </Link>
        )}
      </header>

      <ul className="flex flex-col gap-4">
        {rows.map((row) => {
          const Icon = KIND_ICON[row.kind]
          return (
            <li key={row.kind} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-secondary text-text-2">
                  <Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{t(`agent.${row.kind}`)}</span>
                  <span className="text-[13px] leading-snug text-text-3">
                    {t(`what.${row.kind}`, { name: brand.name })}
                  </span>
                </span>
                {busy === row.key ? <Loader2 className="size-4 animate-spin" /> : null}
                <Switch
                  checked={row.on}
                  disabled={!active || busy !== null}
                  onCheckedChange={(on) => void change(row.key, { [row.key]: on })}
                  aria-label={t(`agent.${row.kind}`)}
                />
              </div>
              <Recent
                actions={actions.filter((a) => a.platform === platform && a.kind === row.kind)}
              />
            </li>
          )
        })}
        <li className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-secondary text-text-2">
              <PenLine className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">{t("agent.post")}</span>
              <span className="text-[13px] leading-snug text-text-3">
                {t(platform === "x" ? "what.post" : "what.postInstagram")}
              </span>
            </span>
          </div>
          <fieldset className="ms-11 grid grid-cols-3 gap-1 rounded-pill bg-background p-1 ring-1 ring-border">
            <legend className="sr-only">{t("agent.post")}</legend>
            {(["off", "ask", "auto"] as const).map((p) => {
              const disabled = !active || busy !== null || (p === "auto" && platform !== "x")
              return (
                <label
                  key={p}
                  className={cn(
                    "grid h-8 cursor-pointer place-items-center rounded-pill text-[12.5px] font-semibold transition-colors has-disabled:cursor-default has-disabled:opacity-40 has-focus-visible:ring-2 has-focus-visible:ring-ring",
                    c.posts === p
                      ? "bg-foreground text-background"
                      : "text-text-2 hover:bg-secondary",
                  )}
                >
                  <input
                    type="radio"
                    name={`posts-${platform}`}
                    value={p}
                    checked={c.posts === p}
                    disabled={disabled}
                    onChange={() => void change("posts", { posts: p })}
                    className="sr-only"
                  />
                  {t(`policy.${p}`)}
                </label>
              )
            })}
          </fieldset>
          {ready.map((d) => (
            <DraftCard key={d.id} draft={d} onDone={() => void refresh()} />
          ))}
          {c.posts !== "off" && active && !ready.length ? (
            <button
              type="button"
              disabled={writing}
              onClick={() => void write()}
              className="ms-11 flex h-9 w-fit items-center gap-1.5 rounded-pill bg-secondary px-3.5 text-[13px] font-semibold disabled:opacity-60"
            >
              {writing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <PenLine className="size-3.5" />
              )}
              {t("writeNow")}
            </button>
          ) : null}
          <Recent actions={actions.filter((a) => a.platform === platform && a.kind === "post")} />
        </li>
      </ul>
    </section>
  )
}

function Routine({ icon: Icon, title, line }: { icon: LucideIcon; title: string; line: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-secondary text-text-2">
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] leading-snug text-text-3">{line}</span>
      </span>
    </li>
  )
}

export function AgentsView() {
  const t = useTranslations("Agents")
  const format = useFormatter()
  const queryClient = useQueryClient()
  const summary = useQuery({
    queryKey: ["agents"],
    queryFn: () => api<Summary>("/api/agents"),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["agents"] })
  const s = summary.data
  const live = s?.connections.filter((c) => c.platform === "x" || c.platform === "instagram") ?? []
  const now = new Date()

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-16 md:px-0">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-title text-[2rem] leading-none">{t("title")}</h1>
        <p className="text-[15px] text-text-2">{t("lead")}</p>
      </header>

      {summary.isPending ? (
        <div className="h-72 animate-pulse rounded-card bg-card" />
      ) : live.length ? (
        live.map((c) => (
          <AccountCard
            key={c.platform}
            connection={c}
            actions={s?.actions ?? []}
            drafts={s?.drafts ?? []}
            refresh={refresh}
          />
        ))
      ) : (
        <section className="flex flex-col items-start gap-3 rounded-card bg-card p-5 ring-1 ring-border">
          <p className="text-[15px] text-text-2">{t("none")}</p>
          <Link
            href="/connect"
            className="flex h-10 items-center gap-1.5 rounded-pill bg-foreground px-4 text-[14px] font-semibold text-background"
          >
            {t("connect")} <ArrowUpRight className="size-4" />
          </Link>
        </section>
      )}

      {s ? (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[13px] font-semibold text-text-3">{t("routines")}</h2>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card bg-card ring-1 ring-border">
            <Routine
              icon={Sunrise}
              title={t("routine.tuneUp")}
              line={
                s.routines.tuneUp
                  ? t("routine.tuneUpLast", {
                      when: format.relativeTime(
                        new Date(Math.min(Date.parse(s.routines.tuneUp), now.getTime())),
                        now,
                      ),
                    })
                  : t("routine.tuneUpLine")
              }
            />
            <Routine
              icon={Dices}
              title={t("routine.games")}
              line={t("routine.gamesLine", { count: s.routines.circles })}
            />
            <Routine
              icon={CalendarCheck}
              title={t("routine.followUps")}
              line={t("routine.followUpsLine")}
            />
            {s.routines.businesses ? (
              <Routine
                icon={Briefcase}
                title={t("routine.business")}
                line={t("routine.businessLine", { count: s.routines.businesses })}
              />
            ) : null}
            {s.routines.downloads.map((d) => (
              <Routine
                key={d.platform}
                icon={FileDown}
                title={t("routine.download", {
                  name: t(`downloads.${d.platform}` as "downloads.x"),
                })}
                line={t("routine.downloadLine", {
                  when: format.relativeTime(new Date(d.readyAt), now),
                })}
              />
            ))}
            <Routine icon={BellRing} title={t("routine.push")} line={t("routine.pushLine")} />
          </ul>
        </section>
      ) : null}
    </div>
  )
}
