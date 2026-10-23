"use client"

import type { NajimiUIMessage } from "@najimi/agent"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Gamepad2, History, Plus, RotateCcw, Share2, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { Suspense, useEffect, useRef, useState } from "react"
import { GameSheet } from "@/components/games/game-sheet"
import { ProfileLink } from "@/components/people/profile-link"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { useNewChat } from "@/lib/new-chat"
import type { Uploaded } from "@/lib/photo"
import { type RoomStatus, useRoom } from "@/lib/use-room"
import { ChatProvider, shareChat } from "./chat-context"
import { ChatSidebar } from "./chat-sidebar"
import { ChatWelcome, type Starter, type WelcomeTaste } from "./chat-welcome"
import { type ChatPerson, Composer, type Mode } from "./composer"
import { Message } from "./message"
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
  mode: Mode
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
  const [mode, setMode] = useState<Mode>(props.mode)
  const [title, setTitle] = useState(props.title)
  const [history, setHistory] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [gamesOpen, setGamesOpen] = useState(false)
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

  const changeMode = async (next: Mode) => {
    setMode(next)
    if (messages.length)
      await api(`/api/chats/${props.chatId}`, { method: "PATCH", json: { mode: next } }).catch(
        () => undefined,
      )
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
            <h1 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">
              {title ?? (messages.length ? t("untitled") : "")}
            </h1>
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
                    <Face look={m.look} name={m.name} size="xs" />
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
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1
                  const streaming = isLast && m.metadata?.status === "streaming"
                  return (
                    <div key={m.id} className="flex flex-col gap-2">
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
                      {m.role === "assistant" &&
                      !streaming &&
                      (textOf(m) || m.id === lastAssistant?.id) ? (
                        <div className="flex flex-wrap items-center gap-1 text-text-3">
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
              mode={mode}
              onMode={kind === "agent" ? changeMode : undefined}
              busy={busy}
              onSend={(text, photos) => void send(text, photos)}
              onStop={() => void room.stop()}
              initialText={props.ask}
              placeholder={
                kind === "agent" ? undefined : t("roomPlaceholder", { name: roomTitle ?? "" })
              }
            />
          </div>
        </div>
      </div>

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
            {props.invite ? (
              <button
                type="button"
                onClick={async () => {
                  const url = `${window.location.origin}${props.invite}`
                  try {
                    if (navigator.share) await navigator.share({ title: roomTitle ?? "", url })
                    else {
                      await navigator.clipboard.writeText(url)
                      toast(t("linkCopied"))
                    }
                  } catch {}
                }}
                className="mt-2 flex w-full items-center gap-3 rounded-card bg-card p-4 text-start"
              >
                <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                  <UserPlus className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold">{t("invite")}</span>
                  <span className="truncate text-[13px] text-text-3">{t("inviteHint")}</span>
                </span>
              </button>
            ) : null}
            <CircleOverlap chatId={props.chatId} open={membersOpen} />
            <ul className="mt-3 flex flex-col">
              {(props.members ?? []).map((m) => (
                <li key={m.userId}>
                  <ProfileLink
                    username={m.username}
                    className="flex items-center gap-3 rounded-tile px-1 py-2 hover:bg-card"
                  >
                    <Face look={m.look} name={m.name} size="sm" />
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
            <ChatSidebar onPick={() => setHistory(false)} />
          </Suspense>
        </SheetContent>
      </Sheet>
    </ChatProvider>
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
