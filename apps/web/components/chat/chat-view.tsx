"use client"

import type { NajimiUIMessage } from "@najimi/agent"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Copy,
  Gamepad2,
  History,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Share2,
  UserPlus,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Suspense, useEffect, useRef, useState } from "react"
import { QrCode } from "@/components/brands/qr-code"
import { GameSheet } from "@/components/games/game-sheet"
import { ProfileLink } from "@/components/people/profile-link"
import { type Track, usePlayer } from "@/components/player/player"
import { StoryRing } from "@/components/stories/stories-provider"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { useNewChat } from "@/lib/new-chat"
import type { Uploaded } from "@/lib/photo"
import { type RoomStatus, useRoom } from "@/lib/use-room"
import { ChatProvider, shareChat } from "./chat-context"
import { ChatList } from "./chat-list"
import { ChatWelcome, type Starter, type WelcomeTaste } from "./chat-welcome"
import { type ChatPerson, Composer } from "./composer"
import { Message } from "./message"
import { PollSheet } from "./poll-sheet"
import { RoomWelcome } from "./room-welcome"

/** Someone in the room. */
export type RoomMember = {
  userId: string
  name: string
  username: string | null
  look: string | null
  aura: { c1: string; c2: string; c3: string } | null
}

export type ChatViewProps = {
  chatId: string
  /** Your conversation with Najimi, a circle, or a DM. */
  kind?: "agent" | "circle" | "dm"
  /** A circle's name. */
  name?: string | null
  members?: RoomMember[]
  /** A circle's invite link. */
  invite?: string | null
  isNew: boolean
  title: string | null
  messages: NajimiUIMessage[]
  status: RoomStatus
  /** The room's newest live event when the page was made. */
  after: number
  me: string
  people: ChatPerson[]
  starters: Starter[]
  /** The taste an empty chat says it will use. */
  taste: WelcomeTaste
  greetingName: string
  /** A question to start with, typed in for them (from "Ask Najimi" on a feed card). */
  ask?: string
}

const textOf = (m: NajimiUIMessage) =>
  m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n")
    .trim()

/**
 * Your conversation with Najimi, as a room (W6): it streams live to every open tab, keeps going if
 * you leave, and lives in its own scroll area with the composer below it (above the tab bar on a
 * phone), so nothing overlaps. History is a sheet, not a column.
 */
export function ChatView(props: ChatViewProps) {
  const t = useTranslations("Chat")
  const newChat = useNewChat()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(props.title)
  const [history, setHistory] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [gamesOpen, setGamesOpen] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const kind = props.kind ?? "agent"
  const people = new Map((props.members ?? []).map((m) => [m.userId, m]))
  const others = (props.members ?? []).filter((m) => m.userId !== props.me)
  const fromOf = (m: NajimiUIMessage) => {
    if (kind === "agent" || m.role !== "user") return null
    const who = m.metadata?.authorId ? people.get(m.metadata.authorId) : undefined
    return {
      mine: m.metadata?.authorId === props.me,
      name: who?.name ?? "",
      look: who?.look ?? null,
    }
  }
  const roomTitle =
    kind === "circle" ? (props.name ?? "") : kind === "dm" ? (others[0]?.name ?? "") : null
  const room = useRoom({
    chatId: props.chatId,
    initial: props.messages,
    initialStatus: props.status,
    after: props.after,
    me: props.me,
    kind,
    onTitle: (next) => {
      setTitle(next)
      void queryClient.invalidateQueries({ queryKey: ["chats"] })
    },
  })
  const { messages, busy } = room
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  // Follow the answer as it grows, unless they've scrolled up to read.
  const lastParts = messages.at(-1)?.parts.length ?? 0
  const lastText = messages.at(-1) ? textOf(messages.at(-1) as NajimiUIMessage).length : 0
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows new messages and growing text
  useEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages.length, lastParts, lastText])

  const send = async (text: string, photos: Uploaded[] = []) => {
    pinned.current = true
    const ok = await room.send(
      text,
      photos.map((p) => ({ url: p.url })),
    )
    if (!ok) return
    // The address becomes the room's own once it exists.
    if (window.location.pathname.endsWith("/c")) {
      window.history.replaceState(null, "", `/c/${props.chatId}`)
      void queryClient.invalidateQueries({ queryKey: ["chats"] })
    }
  }

  const rename = async (next: string) => {
    const value = next.trim().slice(0, 120)
    if (!value || value === title) return
    const before = title
    setTitle(value)
    try {
      await api(`/api/chats/${props.chatId}`, { method: "PATCH", json: { title: value } })
      void queryClient.invalidateQueries({ queryKey: ["chats"] })
    } catch {
      setTitle(before)
    }
  }
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const failed = lastAssistant?.metadata?.status === "failed"

  return (
    <ChatProvider value={{ chatId: props.chatId, people: props.people, me: props.me }}>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-dvh">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:px-5">
          <button
            type="button"
            onClick={() => setHistory(true)}
            aria-label={t("chats")}
            title={t("chats")}
            className="grid size-10 place-items-center rounded-full text-text-2 transition-colors hover:bg-card hover:text-foreground"
          >
            <History className="size-5" />
          </button>
          {kind === "agent" ? (
            <Title
              value={title ?? (messages.length ? t("untitled") : "")}
              editable={messages.length > 0}
              label={t("rename")}
              onRename={(next) => void rename(next)}
            />
          ) : kind === "dm" ? (
            // A DM's title is the other person: it opens their profile when they have one.
            <ProfileLink
              username={others[0]?.username}
              className="flex min-w-0 flex-1 items-center justify-center gap-2"
            >
              {others[0] ? <Face look={others[0].look} name={others[0].name} size="xs" /> : null}
              <h1 className="truncate text-[15px] font-semibold">{roomTitle}</h1>
            </ProfileLink>
          ) : (
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="flex min-w-0 flex-1 items-center justify-center gap-2"
            >
              <span className="flex -space-x-2">
                {(props.members ?? []).slice(0, 4).map((m) => (
                  <span key={m.userId} className="rounded-full ring-2 ring-background">
                    <StoryRing userId={m.userId} name={m.name} look={m.look} decorative>
                      <Face look={m.look} name={m.name} size="xs" />
                    </StoryRing>
                  </span>
                ))}
              </span>
              <h1 className="truncate text-[15px] font-semibold">{roomTitle}</h1>
            </button>
          )}
          {kind === "agent" ? null : (
            <button
              type="button"
              onClick={() => setGamesOpen(true)}
              aria-label={t("play")}
              title={t("play")}
              className="grid size-10 place-items-center rounded-full text-text-2 transition-colors hover:bg-card hover:text-foreground"
            >
              <Gamepad2 className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={newChat}
            aria-label={t("newChat")}
            title={t("newChat")}
            className="grid size-10 place-items-center rounded-full text-text-2 transition-colors hover:bg-card hover:text-foreground"
          >
            <Plus className="size-5" />
          </button>
        </header>

        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
            // Near the top: the page before, with the reading place kept where it was.
            if (el.scrollTop < 240 && room.hasOlder && !room.loadingOlder) {
              const from = el.scrollHeight
              void room.older().then((n) => {
                if (n)
                  requestAnimationFrame(() =>
                    el.scrollTo({ top: el.scrollHeight - from + el.scrollTop }),
                  )
              })
            }
          }}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col px-4 md:px-6">
            {messages.length === 0 && kind !== "agent" ? (
              <RoomWelcome name={roomTitle ?? ""} onAsk={(text) => void send(text)} />
            ) : messages.length === 0 ? (
              <ChatWelcome
                greeting={t("greeting", { name: props.greetingName })}
                taste={props.taste}
                starters={props.starters}
                onAsk={(text) => void send(text)}
              />
            ) : (
              <div className="flex flex-col gap-8 py-6">
                {room.loadingOlder ? (
                  <span className="mx-auto flex items-center gap-2 text-[13px] text-text-3">
                    <Loader2 className="size-4 animate-spin" /> {t("older")}
                  </span>
                ) : null}
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1
                  const streaming = isLast && m.metadata?.status === "streaming"
                  return (
                    <div key={m.id} className="group/msg flex flex-col gap-2">
                      <Message
                        message={m}
                        from={fromOf(m)}
                        streaming={streaming}
                        actions={{
                          live: m.metadata?.status === "waiting",
                          onAsk: (text) => void send(text),
                          onAnswer: (toolCallId, output) =>
                            void room.answer(m.id, toolCallId, output),
                          onApprove: (id, approved) => void room.approve(m.id, id, approved),
                        }}
                      />
                      {/* Copy, again and share sit under the latest answer; older ones show
                          them on hover, so the thread stays quiet. */}
                      {m.role === "assistant" &&
                      !streaming &&
                      (textOf(m) || m.id === lastAssistant?.id) ? (
                        <div
                          className={cn(
                            "flex flex-wrap items-center gap-1 text-text-3 transition-opacity",
                            m.id === lastAssistant?.id
                              ? "opacity-100"
                              : "opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100",
                          )}
                        >
                          {textOf(m) ? (
                            <IconButton
                              label={t("copy")}
                              onClick={() =>
                                navigator.clipboard
                                  .writeText(textOf(m))
                                  .then(() => toast(t("copied")))
                              }
                            >
                              <Copy className="size-4" />
                            </IconButton>
                          ) : null}
                          {m.id === lastAssistant?.id && !busy ? (
                            <IconButton label={t("regenerate")} onClick={() => void room.retry()}>
                              <RotateCcw className="size-4" />
                            </IconButton>
                          ) : null}
                          <IconButton
                            label={t("shareChat")}
                            onClick={() => void shareChat(props.chatId, t("linkCopied"))}
                          >
                            <Share2 className="size-4" />
                          </IconButton>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                {busy && messages.at(-1)?.role === "user" ? (
                  <p className="flex items-center gap-2 text-sm text-text-3">
                    <span className="size-2 animate-pulse rounded-full bg-[var(--color-aura-1)]" />
                    {t("thinking")}
                  </p>
                ) : null}
                {failed || room.error ? (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-destructive">
                      {(room.error ?? lastAssistant?.metadata?.error ?? "").includes(
                        "out-of-credit",
                      )
                        ? t("outOfCredit")
                        : (room.error ?? t("error"))}
                    </span>
                    {failed ? (
                      <button
                        type="button"
                        onClick={() => void room.retry()}
                        className="rounded-pill px-3 py-1 text-xs font-semibold ring-1 ring-border"
                      >
                        {t("retry")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-4 pt-2 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6">
          <div className="mx-auto w-full max-w-3xl">
            <Composer
              person={props.people[0]}
              busy={busy}
              onSend={(text, photos) => void send(text, photos)}
              onStop={() => void room.stop()}
              initialText={props.ask}
              onPoll={kind === "agent" ? undefined : () => setPollOpen(true)}
              placeholder={
                kind === "agent" ? undefined : t("roomPlaceholder", { name: roomTitle ?? "" })
              }
            />
          </div>
        </div>
      </div>

      {kind === "agent" ? null : (
        <PollSheet open={pollOpen} onOpenChange={setPollOpen} chatId={props.chatId} />
      )}

      {kind === "agent" ? null : (
        <GameSheet
          open={gamesOpen}
          onOpenChange={setGamesOpen}
          chatId={props.chatId}
          members={props.members ?? []}
          me={props.me}
          title={roomTitle ?? ""}
        />
      )}

      {kind === "circle" ? (
        <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <SheetTitle className="font-title pt-5 text-[1.75rem] font-normal">
              {roomTitle}
            </SheetTitle>
            <Soundtrack chatId={props.chatId} open={membersOpen} />
            {props.invite ? <InviteCard path={props.invite} name={roomTitle ?? ""} /> : null}
            <CircleOverlap chatId={props.chatId} open={membersOpen} />
            <ul className="mt-3 flex flex-col">
              {(props.members ?? []).map((m) => (
                <li key={m.userId}>
                  <ProfileLink
                    username={m.username}
                    className="flex items-center gap-3 rounded-tile px-1 py-2 hover:bg-card"
                  >
                    <StoryRing userId={m.userId} name={m.name} look={m.look} decorative>
                      <Face look={m.look} name={m.name} size="sm" />
                    </StoryRing>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-semibold">
                        {m.name}
                        {m.userId === props.me ? ` · ${t("you")}` : ""}
                      </span>
                      {m.username ? (
                        <span className="text-[13px] text-text-3">@{m.username}</span>
                      ) : null}
                    </span>
                  </ProfileLink>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
      ) : null}

      <Sheet open={history} onOpenChange={setHistory}>
        <SheetContent side="left" className="w-[min(85vw,22rem)] border-0 bg-background p-0">
          <SheetTitle className="sr-only">{t("chats")}</SheetTitle>
          <Suspense fallback={null}>
            <ChatList onPick={() => setHistory(false)} />
          </Suspense>
        </SheetContent>
      </Sheet>
    </ChatProvider>
  )
}

/**
 * The circle's soundtrack: one tap plays songs from everyone's taste blended, through the one
 * player (so it keeps going as they move round the app); the artists show as faces.
 */
function Soundtrack({ chatId, open }: { chatId: string; open: boolean }) {
  const t = useTranslations("Chat")
  const player = usePlayer()
  const tracks = useQuery({
    queryKey: ["soundtrack", chatId],
    queryFn: () =>
      api<{ tracks: (Track & { store: string })[] }>(`/api/rooms/${chatId}/soundtrack`),
    enabled: open,
    staleTime: 5 * 60_000,
  })
  const list = (tracks.data?.tracks ?? []).map((tr) => ({ ...tr, source: "apple" as const }))
  const playing = list.some((tr) => tr.id === player.track?.id) && player.playing
  const art = [...new Map(list.map((tr) => [tr.by, tr.artwork])).values()].slice(0, 4)
  if (tracks.isSuccess && !list.length) return null
  return (
    <button
      type="button"
      disabled={!list.length}
      onClick={() => {
        if (list.some((tr) => tr.id === player.track?.id)) player.toggle()
        else if (list[0]) void player.play(list[0], list)
      }}
      className="mt-2 flex w-full items-center gap-3 rounded-card bg-card p-4 text-start disabled:opacity-70"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--color-aura-1),var(--color-aura-2))] text-white">
        {tracks.isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : playing ? (
          <Pause className="size-5 fill-current" />
        ) : (
          <Play className="ms-0.5 size-5 fill-current" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">{t("soundtrack")}</span>
        <span className="truncate text-[13px] text-text-3">
          {list.length
            ? [...new Set(list.map((tr) => tr.by))].slice(0, 3).join(" · ")
            : t("soundtrackHint")}
        </span>
      </span>
      <span className="flex shrink-0 -space-x-2">
        {art.map((src) =>
          src ? (
            // biome-ignore lint/performance/noImgElement: Apple artwork thumbnail
            <img
              key={src}
              src={src}
              alt=""
              className="size-7 rounded-full object-cover ring-2 ring-card"
            />
          ) : null,
        )}
      </span>
    </button>
  )
}

/** The circle's invite: a QR code to scan across the table, and the link to share. */
function InviteCard({ path, name }: { path: string; name: string }) {
  const t = useTranslations("Chat")
  const [url, setUrl] = useState("")
  useEffect(() => setUrl(`${window.location.origin}${path}`), [path])
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: name, url })
      else {
        await navigator.clipboard.writeText(url)
        toast(t("linkCopied"))
      }
    } catch {}
  }
  return (
    <div className="mt-2 flex items-center gap-4 rounded-card bg-card p-4">
      {url ? (
        <span className="shrink-0 overflow-hidden rounded-tile">
          <QrCode value={url} label={t("inviteQr")} className="size-24" />
        </span>
      ) : (
        <span className="size-24 shrink-0 animate-pulse rounded-tile bg-raised" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">{t("invite")}</span>
          <span className="text-[13px] text-text-3">{t("inviteScan")}</span>
        </span>
        <button
          type="button"
          onClick={() => void share()}
          className="flex h-9 w-fit items-center gap-2 rounded-pill bg-primary px-4 text-[14px] font-semibold text-primary-foreground"
        >
          <UserPlus className="size-4" /> {t("shareInvite")}
        </button>
      </span>
    </div>
  )
}

type Overlap = {
  loves: { qlooId: string; name: string; image: string | null; who: string[] }[]
  words: string[]
}

/** What the circle shares (after 222's "you both…", Refero 00ade516): loves, then words. */
function CircleOverlap({ chatId, open }: { chatId: string; open: boolean }) {
  const t = useTranslations("Chat")
  const overlap = useQuery({
    queryKey: ["overlap", chatId],
    queryFn: () => api<Overlap>(`/api/rooms/${chatId}/overlap`),
    enabled: open,
    staleTime: 60_000,
  })
  const o = overlap.data
  if (!o || (!o.loves.length && !o.words.length)) return null
  return (
    <section className="mt-3 flex flex-col gap-3 rounded-card bg-card p-4">
      {o.loves.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold tracking-[0.06em] text-text-3 uppercase">
            {t("youAllLove")}
          </p>
          <div className="flex flex-wrap gap-2">
            {o.loves.map((l) => (
              <span
                key={l.qlooId}
                title={l.who.join(", ")}
                className="inline-flex items-center gap-2 rounded-pill bg-secondary py-1 ps-1 pe-3 text-[13px] font-semibold"
              >
                {l.image ? (
                  // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
                  <img src={l.image} alt="" className="size-6 rounded-full object-cover" />
                ) : null}
                {l.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {o.words.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] font-semibold tracking-[0.06em] text-text-3 uppercase">
            {t("youAllAre")}
          </p>
          <p className="font-title text-[1.3rem] leading-snug">{o.words.slice(0, 6).join(" · ")}</p>
        </div>
      ) : null}
    </section>
  )
}

/** Your chat's title; a tap turns it into a field (Enter or leaving it saves, Escape doesn't). */
function Title({
  value,
  editable,
  label,
  onRename,
}: {
  value: string
  editable: boolean
  label: string
  onRename: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (editing)
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: the field appears because they asked to rename
        autoFocus
        defaultValue={value}
        aria-label={label}
        maxLength={120}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => {
          setEditing(false)
          onRename(e.currentTarget.value)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") {
            e.currentTarget.value = value
            e.currentTarget.blur()
          }
        }}
        className="min-w-0 flex-1 rounded-tile bg-card px-3 py-1.5 text-center text-[15px] font-semibold outline-none ring-1 ring-white/15"
      />
    )
  return (
    <h1 className="flex min-w-0 flex-1 justify-center">
      {editable ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={label}
          className="max-w-full truncate rounded-tile px-2 py-1 text-[15px] font-semibold transition-colors hover:bg-card"
        >
          {value}
        </button>
      ) : (
        <span className="truncate text-[15px] font-semibold">{value}</span>
      )}
    </h1>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  )
}
