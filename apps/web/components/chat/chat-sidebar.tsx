"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { MoreHorizontal, Plus, Search } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"
import { useNewChat } from "@/lib/new-chat"

type ChatItem = {
  id: string
  title: string | null
  name: string | null
  kind: "agent" | "circle" | "dm"
  other: string | null
  status: string
  lastActiveAt: string
}

/** What a room is called: a circle by its name, a DM by the other person, a chat with Najimi by its title. */
const labelOf = (c: ChatItem) =>
  c.kind === "circle" ? c.name : c.kind === "dm" ? c.other : c.title

/** Every chat, newest first, searchable; rename and delete from each row's menu. */
export function ChatSidebar({ onPick }: { onPick?: () => void } = {}) {
  const t = useTranslations("Chat")
  const newChat = useNewChat()
  const params = useParams<{ id?: string }>()
  const queryClient = useQueryClient()
  const [q, setQ] = useState("")
  const chats = useQuery({
    queryKey: ["chats", q],
    queryFn: () =>
      api<{ chats: ChatItem[] }>(`/api/chats${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    staleTime: 10_000,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["chats"] })

  return (
    <nav className="flex h-full flex-col gap-3 p-3">
      <button
        type="button"
        onClick={() => {
          onPick?.()
          newChat()
        }}
        className="inline-flex items-center justify-center gap-2 rounded-pill bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <Plus className="size-4" /> {t("newChat")}
      </button>
      <label className="flex items-center gap-2 rounded-pill bg-secondary px-3 py-2 text-sm">
        <Search className="size-4 text-text-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchChats")}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {(chats.data?.chats ?? []).map((c) => (
          <li key={c.id} className="group flex items-center">
            <Link
              href={`/c/${c.id}`}
              onClick={onPick}
              className={cn(
                "min-w-0 flex-1 truncate rounded-tile px-3 py-2 text-sm transition-colors",
                params.id === c.id ? "bg-raised font-semibold" : "text-text-2 hover:bg-raised/60",
              )}
            >
              {c.status === "generating" ? (
                <span className="me-1.5 inline-block size-1.5 animate-signal-pulse rounded-full bg-signal align-middle" />
              ) : null}
              {labelOf(c) ?? t("untitled")}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("chatActions")}
                className="grid size-7 place-items-center rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-raised"
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {c.kind === "agent" ? (
                  <DropdownMenuItem
                    onClick={async () => {
                      const title = window.prompt(t("rename"), c.title ?? "")?.trim()
                      if (!title) return
                      await api(`/api/chats/${c.id}`, { method: "PATCH", json: { title } })
                      await refresh()
                    }}
                  >
                    {t("rename")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={async () => {
                    if (!window.confirm(t("confirmDelete"))) return
                    await api(`/api/chats/${c.id}`, { method: "DELETE" })
                    await refresh()
                    // The chat on screen (its address may be /c/<id> without the router knowing).
                    if (params.id === c.id || window.location.pathname.endsWith(`/c/${c.id}`))
                      newChat()
                  }}
                >
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
        {chats.isSuccess && !chats.data.chats.length ? (
          <li className="px-3 py-2 text-sm text-text-3">{t("noChats")}</li>
        ) : null}
      </ul>
    </nav>
  )
}
