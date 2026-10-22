"use client"

import type { NajimiUIMessage } from "@najimi/agent"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Copy, History, Plus, RotateCcw, Share2 } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Suspense, useEffect, useRef, useState } from "react"
import { api } from "@/lib/fetcher"
import type { Uploaded } from "@/lib/photo"
import { type RoomStatus, useRoom } from "@/lib/use-room"
import { ChatProvider, shareChat } from "./chat-context"
import { ChatSidebar } from "./chat-sidebar"
import { ChatWelcome, type Starter, type WelcomeTaste } from "./chat-welcome"
import { type ChatPerson, Composer, type Mode } from "./composer"
import { Message } from "./message"

export type ChatViewProps = {
  chatId: string
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
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>(props.mode)
  const [title, setTitle] = useState(props.title)
  const [history, setHistory] = useState(false)
  const room = useRoom({
    chatId: props.chatId,
    initial: props.messages,
    initialStatus: props.status,
    after: props.after,
    me: props.me,
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
    <ChatProvider value={{ chatId: props.chatId, people: props.people }}>
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
          <h1 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">
            {title ?? (messages.length ? t("untitled") : "")}
          </h1>
          <Link
            href="/c"
            aria-label={t("newChat")}
            title={t("newChat")}
            className="grid size-10 place-items-center rounded-full text-text-2 transition-colors hover:bg-card hover:text-foreground"
          >
            <Plus className="size-5" />
          </Link>
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
            {messages.length === 0 ? (
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
              onMode={changeMode}
              busy={busy}
              onSend={(text, photos) => void send(text, photos)}
              onStop={() => void room.stop()}
              initialText={props.ask}
            />
          </div>
        </div>
      </div>

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
