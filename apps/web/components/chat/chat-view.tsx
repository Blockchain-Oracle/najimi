"use client"

import type { NajimiUIMessage } from "@najimi/agent"
import { AGENT } from "@najimi/config"
import { toast } from "@najimi/ui/components/sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Copy, RotateCcw, Share2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { useNajimiChat } from "@/lib/chat/use-najimi-chat"
import { api } from "@/lib/fetcher"
import type { Uploaded } from "@/lib/photo"
import { ChatProvider, shareChat } from "./chat-context"
import { ChatWelcome, type Starter, type WelcomeTaste } from "./chat-welcome"
import { type ChatPerson, Composer, type Mode } from "./composer"
import { Message } from "./message"

export type ChatViewProps = {
  chatId: string
  isNew: boolean
  messages: NajimiUIMessage[]
  status: "idle" | "generating" | "waiting"
  turnStartedAt: string | null
  mode: Mode
  people: ChatPerson[]
  starters: Starter[]
  /** The taste an empty chat says it will use. */
  taste: WelcomeTaste
  greetingName: string
}

const textOf = (m: NajimiUIMessage) =>
  m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n")
    .trim()

/** The chat (C2): the conversation, its cards, and the composer; the server keeps the history. */
export function ChatView(props: ChatViewProps) {
  const t = useTranslations("Chat")
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>(props.mode)
  const [started, setStarted] = useState(!props.isNew)
  const chat = useNajimiChat(props.chatId, props.messages)
  const {
    messages,
    status,
    sendMessage,
    stop,
    regenerate,
    addToolOutput,
    addToolApprovalResponse,
  } = chat
  const busy = status === "submitted" || status === "streaming"
  const bottom = useRef<HTMLDivElement>(null)

  // A turn that was running when the page loaded (another tab, a reload): it finishes on the
  // server, so refresh until it's saved; past the timeout it was cut off (a restart) → Retry.
  const stale =
    props.status === "generating" &&
    props.turnStartedAt !== null &&
    Date.now() - new Date(props.turnStartedAt).getTime() > AGENT.turnTimeoutMs
  const stillRunning = props.status === "generating" && !stale && !busy
  useEffect(() => {
    if (!stillRunning) return
    const timer = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(timer)
  }, [stillRunning, router])

  useEffect(() => {
    if (messages.length) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length])

  useEffect(() => {
    if (status === "ready" && started) void queryClient.invalidateQueries({ queryKey: ["chats"] })
  }, [status, started, queryClient])

  // The URL becomes the chat's own once its first answer is in (changing it mid-stream, or before
  // the router has hydrated, would hand the page to the router and drop the live view).
  useEffect(() => {
    if (started && status === "ready" && window.location.pathname !== `/c/${props.chatId}`)
      window.history.replaceState(null, "", `/c/${props.chatId}`)
  }, [started, status, props.chatId])

  const send = (text: string, photos: Uploaded[] = []) => {
    if (!started) setStarted(true)
    void sendMessage({
      text,
      files: photos.map((p) => ({
        type: "file" as const,
        mediaType: "image/jpeg",
        url: p.url,
        filename: "photo.jpg",
      })),
    })
  }

  const changeMode = async (next: Mode) => {
    setMode(next)
    if (started)
      await api(`/api/chats/${props.chatId}`, { method: "PATCH", json: { mode: next } }).catch(
        () => undefined,
      )
  }
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")

  return (
    <ChatProvider value={{ chatId: props.chatId, people: props.people }}>
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col px-4 md:px-6">
        {messages.length === 0 ? (
          <ChatWelcome
            person={props.people[0]}
            greeting={t("greeting", { name: props.greetingName })}
            taste={props.taste}
            starters={props.starters}
            onAsk={(text) => send(text)}
          />
        ) : (
          <div className="flex flex-1 flex-col gap-8 py-6">
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1
              return (
                <div key={m.id} className="flex flex-col gap-2">
                  <Message
                    message={m}
                    streaming={busy && isLast}
                    actions={{
                      live: isLast && !busy,
                      onAsk: (text) => send(text),
                      onAnswer: (toolCallId, output) =>
                        void addToolOutput({ tool: "askUser", toolCallId, output }),
                      onApprove: (id, approved) => void addToolApprovalResponse({ id, approved }),
                    }}
                  />
                  {/* Every reply with words gets its actions; the last one always does (a reply
                      can be all cards). */}
                  {m.role === "assistant" &&
                  !(busy && isLast) &&
                  (textOf(m) || m.id === lastAssistant?.id) ? (
                    <div className="flex flex-wrap items-center gap-1 text-text-3">
                      {textOf(m) ? (
                        <IconButton
                          label={t("copy")}
                          onClick={() =>
                            navigator.clipboard.writeText(textOf(m)).then(() => toast(t("copied")))
                          }
                        >
                          <Copy className="size-4" />
                        </IconButton>
                      ) : null}
                      {m.id === lastAssistant?.id ? (
                        <IconButton
                          label={t("regenerate")}
                          onClick={() => void regenerate({ messageId: m.id })}
                        >
                          <RotateCcw className="size-4" />
                        </IconButton>
                      ) : null}
                      {m.id === lastAssistant?.id ? (
                        // The last reply names its actions: a phone has no hover to explain an icon.
                        <PillButton onClick={() => void shareChat(props.chatId, t("linkCopied"))}>
                          <Share2 className="size-3.5" /> {t("share")}
                        </PillButton>
                      ) : (
                        <IconButton
                          label={t("shareChat")}
                          onClick={() => void shareChat(props.chatId, t("linkCopied"))}
                        >
                          <Share2 className="size-4" />
                        </IconButton>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
            {stillRunning ? (
              <p className="flex items-center gap-2 text-sm text-text-3">
                <span className="size-2 animate-signal-pulse rounded-full bg-signal" />{" "}
                {t("stillWorking")}
              </p>
            ) : null}
            {stale || chat.error ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-destructive">
                  {stale
                    ? t("interrupted")
                    : chat.error?.message.includes("out-of-credit")
                      ? t("outOfCredit")
                      : t("error")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void regenerate(lastAssistant ? { messageId: lastAssistant.id } : undefined)
                  }
                  className="sticker px-3 py-1 text-xs font-semibold"
                >
                  {t("retry")}
                </button>
              </div>
            ) : null}
            <div ref={bottom} />
          </div>
        )}
        {/* Full-bleed, so rows that run to the screen edge pass under it rather than beside it. */}
        <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-md:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] max-md:pb-3 md:-mx-6 md:px-6">
          <Composer
            person={props.people[0]}
            mode={mode}
            onMode={changeMode}
            busy={busy}
            onSend={send}
            onStop={() => void stop()}
            ideas={props.starters.map((s) => s.text)}
          />
        </div>
      </div>
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

function PillButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ms-1 inline-flex items-center gap-1.5 rounded-pill border border-foreground/15 px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:border-lime hover:text-lime focus-visible:border-lime"
    >
      {children}
    </button>
  )
}
