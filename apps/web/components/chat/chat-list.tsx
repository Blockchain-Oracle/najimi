"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { Orb } from "@najimi/ui/components/orb"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { MoreHorizontal, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { StoryRing } from "@/components/stories/stories-provider"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { useNewChat } from "@/lib/new-chat"

/*
 * Chats (replaces the plain history list): search, tabs by kind (All · Najimi · Circles ·
 * People), a band of pinned rooms on top, and rows grouped Today / This week / Earlier, each with
 * the room's face (Najimi's orb, the person, the circle's people), its last line, the time and
 * how many messages wait unread. After Telegram's pinned band and tabs (Refero b0f51fe1) and
 * Gemini's Pinned / Today grouping (70a9cd65).
 */

type ChatItem = {
  id: string
  title: string | null
  name: string | null
  kind: "agent" | "circle" | "dm"
  other: string | null
  status: string
  lastActiveAt: string
  faces: { userId: string; name: string; look: string | null }[]
  last: {
    role: "user" | "assistant"
    mine: boolean
    author: string | null
    text: string | null
    tool: string | null
  } | null
  unread: number
  pinnedAt: string | null
}

const TABS = ["all", "agent", "circle", "dm"] as const
type Tab = (typeof TABS)[number]

const DAY = 24 * 60 * 60 * 1000

/** The room's face: Najimi's orb, the other person, or the circle's first two people. */
function RoomFace({ chat, size = 44 }: { chat: ChatItem; size?: 44 | 56 }) {
  if (chat.kind === "agent") return <Orb size={size} working={chat.status === "generating"} />
  const [a, b] = chat.faces
  if (chat.kind === "dm" || !b) {
    const face = (
      <span className={cn("grid shrink-0 place-items-center", size === 56 ? "size-14" : "size-11")}>
        <Face look={a?.look ?? null} name={a?.name ?? chat.name ?? "?"} size="md" />
      </span>
    )
    // A DM shows the other person's story ring; the row still opens the chat.
    return chat.kind === "dm" && a ? (
      <StoryRing userId={a.userId} name={a.name} look={a.look} decorative>
        {face}
      </StoryRing>
    ) : (
      face
    )
  }
  return (
    <span className={cn("relative shrink-0", size === 56 ? "size-14" : "size-11")}>
      <span className="absolute top-0 start-0">
        <Face look={a?.look ?? null} name={a?.name ?? ""} size="sm" />
      </span>
      <span className="absolute end-0 bottom-0 rounded-full ring-2 ring-background">
        <Face look={b.look} name={b.name} size="sm" />
      </span>
    </span>
  )
}

export function ChatList({ onPick }: { onPick?: () => void } = {}) {
  const t = useTranslations("Chats")
  const tc = useTranslations("Chat")
  const format = useFormatter()
  const newChat = useNewChat()
  const params = useParams<{ id?: string }>()
  const queryClient = useQueryClient()
  const [q, setQ] = useState("")
  const [tab, setTab] = useState<Tab>("all")
  const chats = useQuery({
    queryKey: ["chats", q],
    queryFn: () =>
      api<{ chats: ChatItem[] }>(`/api/chats${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    staleTime: 5_000,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["chats"] })
  const all = chats.data?.chats ?? []
  const shown = tab === "all" ? all : all.filter((c) => c.kind === tab)
  const pinned = shown
    .filter((c) => c.pinnedAt)
    .sort((a, b) => (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? ""))
  const rest = shown.filter((c) => !c.pinnedAt)

  const labelOf = (c: ChatItem) =>
    (c.kind === "circle" ? c.name : c.kind === "dm" ? c.other : c.title) ?? tc("untitled")

  const lineOf = (c: ChatItem) => {
    const l = c.last
    if (!l) return t("empty")
    const tool = l.tool?.replace(/^tool-/, "")
    // The reply's words as plain text (no markdown marks), on one line.
    const words = l.text
      ?.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`#>~]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
    const what =
      words ||
      (tool && t.has(`tools.${tool}` as "tools.planNight")
        ? t(`tools.${tool}` as "tools.planNight")
        : t("card"))
    const who = l.mine
      ? t("you")
      : l.role === "assistant"
        ? c.kind === "agent"
          ? null
          : "Najimi"
        : c.kind === "circle"
          ? l.author
          : null
    return who ? `${who}: ${what}` : what
  }

  const timeOf = (iso: string) => {
    const at = new Date(iso)
    const ago = Date.now() - at.getTime()
    if (at.toDateString() === new Date().toDateString())
      return format.dateTime(at, { hour: "numeric", minute: "2-digit" })
    if (ago < 6 * DAY) return format.dateTime(at, { weekday: "short" })
    return format.dateTime(at, { day: "numeric", month: "short" })
  }

  const groups: { key: "today" | "week" | "earlier"; items: ChatItem[] }[] = [
    { key: "today", items: [] },
    { key: "week", items: [] },
    { key: "earlier", items: [] },
  ]
  for (const c of rest) {
    const at = new Date(c.lastActiveAt)
    const key =
      at.toDateString() === new Date().toDateString()
        ? 0
        : Date.now() - at.getTime() < 7 * DAY
          ? 1
          : 2
    groups[key]?.items.push(c)
  }

  const pin = async (c: ChatItem, on: boolean) => {
    await api(`/api/chats/${c.id}`, { method: "PATCH", json: { pinned: on } }).catch(() => null)
    await refresh()
  }
  const remove = async (c: ChatItem) => {
    if (!window.confirm(c.kind === "agent" ? tc("confirmDelete") : t("confirmLeave"))) return
    await api(`/api/chats/${c.id}`, { method: "DELETE" })
    await refresh()
    if (params.id === c.id || window.location.pathname.endsWith(`/c/${c.id}`)) newChat()
  }

  const menu = (c: ChatItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tc("chatActions")}
        title={tc("chatActions")}
        className="grid size-8 shrink-0 place-items-center rounded-full text-text-3 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:bg-raised data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => void pin(c, !c.pinnedAt)}>
          {c.pinnedAt ? <PinOff /> : <Pin />} {c.pinnedAt ? t("unpin") : t("pin")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void remove(c)} variant="destructive">
          <Trash2 /> {c.kind === "agent" ? tc("delete") : t("leave")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <nav className="flex h-full flex-col">
      <header className="flex items-center gap-2 px-4 pt-4 pb-3">
        <h2 className="flex-1 font-title text-[1.6rem] leading-none">{t("title")}</h2>
        <button
          type="button"
          onClick={() => {
            onPick?.()
            newChat()
          }}
          aria-label={tc("newChat")}
          title={tc("newChat")}
          className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
        >
          <Plus className="size-5" />
        </button>
      </header>

      <div className="flex flex-col gap-3 px-4 pb-2">
        <label className="flex h-10 items-center gap-2 rounded-pill bg-secondary px-3.5 text-[14px]">
          <Search className="size-4 shrink-0 text-text-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tc("searchChats")}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <div
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]"
          role="tablist"
        >
          {TABS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "h-8 shrink-0 rounded-pill px-3.5 text-[13px] font-semibold transition-colors",
                tab === k ? "bg-foreground text-background" : "bg-secondary text-text-2",
              )}
            >
              {t(`tabs.${k}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {pinned.length ? (
          <section className="flex flex-col gap-2 px-4 pt-2 pb-3">
            <h3 className="text-[11px] font-semibold tracking-[0.1em] text-text-3 uppercase">
              {t("pinned")}
            </h3>
            <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none]">
              {pinned.map((c) => (
                <li key={c.id} className="w-16 shrink-0">
                  <Link
                    href={`/c/${c.id}`}
                    onClick={onPick}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="relative">
                      <RoomFace chat={c} size={56} />
                      {c.unread ? <Badge n={c.unread} className="absolute -end-1 -top-1" /> : null}
                    </span>
                    <span className="w-full truncate text-center text-[12px] font-semibold">
                      {labelOf(c)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {groups.map((g) =>
          g.items.length ? (
            <section key={g.key} className="flex flex-col pt-2">
              <h3 className="px-4 pb-1 text-[11px] font-semibold tracking-[0.1em] text-text-3 uppercase">
                {t(`groups.${g.key}`)}
              </h3>
              <ul className="flex flex-col">
                {g.items.map((c) => {
                  const current = params.id === c.id
                  return (
                    <li key={c.id} className="group flex items-center gap-1 pe-2">
                      <Link
                        href={`/c/${c.id}`}
                        onClick={onPick}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 rounded-tile py-2 ps-4 pe-1 transition-colors",
                          current ? "bg-raised" : "hover:bg-raised/60",
                        )}
                      >
                        <RoomFace chat={c} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex items-baseline gap-2">
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-[15px]",
                                c.unread ? "font-bold" : "font-semibold",
                              )}
                            >
                              {labelOf(c)}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-[12px] tabular-nums",
                                c.unread ? "text-[var(--color-aura-1)]" : "text-text-3",
                              )}
                            >
                              {timeOf(c.lastActiveAt)}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-[13px]",
                                c.unread ? "text-foreground" : "text-text-3",
                              )}
                            >
                              {c.status === "generating" ? t("thinking") : lineOf(c)}
                            </span>
                            {c.unread ? <Badge n={c.unread} /> : null}
                          </span>
                        </span>
                      </Link>
                      {menu(c)}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null,
        )}

        {chats.isSuccess && !shown.length ? (
          <p className="px-4 py-6 text-[14px] text-text-3">{q ? t("noMatch") : tc("noChats")}</p>
        ) : null}
        {chats.isPending ? (
          <ul className="flex flex-col gap-1 px-4 pt-2" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="size-11 animate-pulse rounded-full bg-raised" />
                <span className="flex flex-1 flex-col gap-1.5">
                  <span className="h-3.5 w-1/2 animate-pulse rounded bg-raised" />
                  <span className="h-3 w-3/4 animate-pulse rounded bg-raised" />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </nav>
  )
}

function Badge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[var(--color-aura-1)] px-1.5 text-[11px] font-bold text-white tabular-nums",
        className,
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  )
}
