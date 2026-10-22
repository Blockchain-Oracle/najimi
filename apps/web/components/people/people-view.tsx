"use client"

import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, ExternalLink, Loader2, MessageCircle, Plus, Search, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { PlaySection } from "@/components/games/play-section"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { useDebounced } from "@/lib/use-debounced"
import { AuraFace, FollowButton, type PersonCard, PersonRow } from "./person-row"

/*
 * People (W7, W8): find someone by @username, your circles, your friends, people here whose taste
 * is like yours, and people in culture who share it. After Daze's username search and Bond's
 * requests (Refero 2a6a5c17, b16f1edd) and Duolingo's friends with suggestions (fa4e3d25).
 */

export type PeopleHome = {
  /** Your own taste's artwork (the game tiles wear it). */
  art: string[]
  lounge: { id: string; member: boolean; members: number } | null
  friends: PersonCard[]
  twins: (PersonCard & { shared: number })[]
  circles: { id: string; name: string; members: PersonCard[] }[]
  unread: number
  /** Your news topic's newest event when the page was made (the live inbox starts after it). */
  after: number
  figures: {
    id: string
    name: string
    image: string | null
    caption: string | null
    link: string | null
  }[]
}

type Notice = {
  id: string
  kind: "follow" | "joined" | "mention" | "message" | "invite" | "played" | "drop"
  chatId: string | null
  data: Record<string, unknown>
  read: boolean
  at: string
  actor: PersonCard | null
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold tracking-[0.06em] text-text-3 uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Inbox({ initialUnread, after }: { initialUnread: number; after: number }) {
  const t = useTranslations("Social")
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(initialUnread)
  const items = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ unread: number; items: Notice[] }>("/api/notifications"),
    enabled: open,
  })
  // News arrives live: the badge counts up, an open inbox refreshes.
  useEffect(() => {
    const source = new EventSource(`/api/me/live?after=${after}`)
    source.onmessage = (e: MessageEvent<string>) => {
      const { type } = JSON.parse(e.data) as { type: string }
      if (type !== "notification") return
      setUnread((n) => n + 1)
      void queryClient.invalidateQueries({ queryKey: ["notifications"] })
    }
    return () => source.close()
  }, [queryClient, after])
  const line = (n: Notice) => {
    const who = n.actor?.name ?? t("someone")
    const name = (n.data.name as string | undefined) ?? ""
    if (n.kind === "follow") return t("noticeFollow", { who })
    if (n.kind === "joined") return t("noticeJoined", { who, name })
    if (n.kind === "invite") return t("noticeInvite", { who, name })
    if (n.kind === "message")
      return t("noticeMessage", { who, text: (n.data.text as string | undefined) ?? "" })
    if (n.kind === "played")
      return t("noticePlayed", {
        who: n.actor?.name ?? name,
        title: (n.data.title as string | undefined) ?? "",
        score: Number(n.data.score ?? 0),
      })
    if (n.kind === "drop") return t("noticeDrop", { name })
    return t("noticeMention", { who })
  }
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setUnread(0)
          void api("/api/notifications", { json: {} }).catch(() => null)
        }}
        aria-label={t("inbox")}
        className="relative grid size-11 place-items-center rounded-full bg-card transition-colors hover:bg-secondary"
      >
        <Bell className="size-5" />
        {unread ? (
          <span className="absolute -top-0.5 -end-0.5 grid min-w-5 place-items-center rounded-full bg-[var(--color-aura-1)] px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[min(92vw,26rem)] overflow-y-auto border-0 bg-background p-5"
        >
          <SheetTitle className="font-title text-[1.75rem] font-normal">{t("inbox")}</SheetTitle>
          {items.isPending ? (
            <Loader2 className="mt-6 size-5 animate-spin text-text-3" />
          ) : items.data?.items.length ? (
            <ul className="mt-2 flex flex-col">
              {items.data.items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-center gap-2 rounded-tile pe-2 transition-colors hover:bg-card",
                    !n.read && "bg-card/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      if (typeof n.data.token === "string") router.push(`/play/${n.data.token}`)
                      else if (n.chatId) router.push(`/c/${n.chatId}`)
                      else if (n.actor?.username) router.push(`/u/${n.actor.username}`)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-start"
                  >
                    {n.actor ? (
                      <AuraFace person={n.actor} size="sm" />
                    ) : (
                      <Users className="size-8" />
                    )}
                    <span className="min-w-0 flex-1 text-[14px] leading-snug">{line(n)}</span>
                  </button>
                  {n.kind === "follow" && n.actor ? (
                    <FollowButton
                      userId={n.actor.userId}
                      initial={{ following: false, friends: false }}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-[15px] text-text-3">{t("inboxEmpty")}</p>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function NewCircle({
  friends,
  open,
  onOpenChange,
}: {
  friends: PersonCard[]
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const t = useTranslations("Social")
  const router = useRouter()
  const [name, setName] = useState("")
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const create = useMutation({
    mutationFn: () =>
      api<{ chatId: string }>("/api/rooms", {
        json: { name: name.trim(), memberIds: [...picked] },
      }),
    onSuccess: ({ chatId }) => {
      onOpenChange(false)
      router.push(`/c/${chatId}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : ""),
  })
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="font-title pt-5 text-[1.75rem] font-normal">
          {t("newCircle")}
        </SheetTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) create.mutate()
          }}
          className="flex flex-col gap-5 pt-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("circleName")}
            maxLength={60}
            className="h-12 rounded-tile bg-card px-4 text-[16px] outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
          />
          {friends.length ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-text-3">{t("addFriends")}</p>
              <div className="flex flex-wrap gap-2">
                {friends.map((f) => {
                  const on = picked.has(f.userId)
                  return (
                    <button
                      key={f.userId}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setPicked((s) => {
                          const next = new Set(s)
                          if (on) next.delete(f.userId)
                          else next.add(f.userId)
                          return next
                        })
                      }
                      className={cn(
                        "inline-flex items-center gap-2 rounded-pill py-1 ps-1 pe-3 text-[14px] font-semibold transition-colors",
                        on ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border",
                      )}
                    >
                      <Face look={f.look} name={f.name} size="xs" />
                      {f.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-text-3">{t("inviteLater")}</p>
          )}
          <button
            type="submit"
            disabled={!name.trim() || create.isPending}
            className="h-12 rounded-pill bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            {create.isPending ? (
              <Loader2 className="mx-auto size-5 animate-spin" />
            ) : (
              t("createCircle")
            )}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function PeopleView({ home }: { home: PeopleHome }) {
  const t = useTranslations("Social")
  const router = useRouter()
  const [q, setQ] = useState("")
  const [creating, setCreating] = useState(false)
  const term = useDebounced(q.trim(), 250)
  const found = useQuery({
    queryKey: ["people-search", term],
    queryFn: () =>
      api<{ people: PersonCard[] }>(`/api/people/search?q=${encodeURIComponent(term)}`),
    enabled: term.length > 0,
  })
  const friendIds = new Set(home.friends.map((f) => f.userId))
  const message = async (username: string | null) => {
    if (!username) return
    const { chatId } = await api<{ chatId: string }>("/api/rooms/dm", { json: { username } })
    router.push(`/c/${chatId}`)
  }

  return (
    <div className="flex flex-col gap-7 px-5 pb-10 md:px-0">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-title text-[2rem] leading-none">{t("title")}</h1>
        <Inbox initialUnread={home.unread} after={home.after} />
      </header>

      <label className="flex h-12 items-center gap-2 rounded-pill bg-card px-4 ring-1 ring-border focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 text-text-3" />
        <span className="sr-only">{t("search")}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-4"
        />
        {found.isFetching ? <Loader2 className="size-4 animate-spin text-text-3" /> : null}
      </label>

      {term ? (
        <Section title={t("results")}>
          {found.data?.people.length ? (
            <ul className="flex flex-col">
              {found.data.people.map((p) => (
                <PersonRow
                  key={p.userId}
                  person={p}
                  trailing={
                    <FollowButton
                      userId={p.userId}
                      initial={{
                        following: friendIds.has(p.userId),
                        friends: friendIds.has(p.userId),
                      }}
                    />
                  }
                />
              ))}
            </ul>
          ) : found.isFetching ? null : (
            <p className="text-[14px] text-text-3">{t("noOne")}</p>
          )}
        </Section>
      ) : null}

      {term ? null : <PlaySection art={home.art} lounge={home.lounge} />}

      <Section
        title={t("circles")}
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 text-[13px] font-semibold"
          >
            <Plus className="size-4" /> {t("newCircle")}
          </button>
        }
      >
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
          {home.circles.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.id}`}
              className="flex w-36 shrink-0 flex-col gap-3 rounded-card bg-card p-3 transition-colors hover:bg-secondary"
            >
              <span className="flex -space-x-3">
                {c.members.slice(0, 4).map((m) => (
                  <span key={m.userId} className="rounded-full ring-2 ring-card">
                    <Face look={m.look} name={m.name} size="sm" />
                  </span>
                ))}
              </span>
              <span className="line-clamp-2 text-[14px] font-semibold leading-tight">{c.name}</span>
              <span className="text-[12px] text-text-3">
                {t("members", { count: c.members.length })}
              </span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border p-3 text-[14px] font-semibold text-text-2 hover:text-foreground"
          >
            <Plus className="size-6" />
            {t("newCircle")}
          </button>
        </div>
      </Section>

      <Section title={t("friendsTitle")}>
        {home.friends.length ? (
          <ul className="flex flex-col">
            {home.friends.map((f) => (
              <PersonRow
                key={f.userId}
                person={f}
                trailing={
                  <button
                    type="button"
                    onClick={() => void message(f.username)}
                    aria-label={t("message")}
                    className="grid size-9 place-items-center rounded-full bg-card ring-1 ring-border"
                  >
                    <MessageCircle className="size-4" />
                  </button>
                }
              />
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-text-3">{t("noFriends")}</p>
        )}
      </Section>

      {home.twins.length ? (
        <Section title={t("twins")}>
          <ul className="flex flex-col">
            {home.twins.map((p) => (
              <PersonRow
                key={p.userId}
                person={p}
                note={t("inCommon", { count: p.shared })}
                trailing={
                  <FollowButton userId={p.userId} initial={{ following: false, friends: false }} />
                }
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {home.figures.length ? (
        <Section title={t("figures")}>
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
            {home.figures.map((f) => (
              <a
                key={f.id}
                href={f.link ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-28 shrink-0 flex-col items-center gap-2 text-center"
              >
                {f.image ? (
                  // biome-ignore lint/performance/noImgElement: remote portrait
                  <img src={f.image} alt="" className="size-20 rounded-full object-cover" />
                ) : (
                  <span className="grid size-20 place-items-center rounded-full bg-card font-title text-[22px]">
                    {f.name.slice(0, 1)}
                  </span>
                )}
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
                  {f.name}
                </span>
                {f.link ? <ExternalLink className="size-3.5 text-text-3" /> : null}
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      <NewCircle friends={home.friends} open={creating} onOpenChange={setCreating} />
    </div>
  )
}
