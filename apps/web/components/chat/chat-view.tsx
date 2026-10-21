"use client"

import type { NajimiUIMessage } from "@najimi/agent"
import { AGENT } from "@najimi/config"
import { Dialog, DialogContent, DialogTitle } from "@najimi/ui/components/dialog"
import { toast } from "@najimi/ui/components/sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Copy, GitFork, RotateCcw, Scale } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { Streamdown } from "streamdown"
import { useNajimiChat } from "@/lib/chat/use-najimi-chat"
import { api } from "@/lib/fetcher"
import type { Uploaded } from "@/lib/photo"
import { type ChatPerson, Composer, type Mode } from "./composer"
import { Message } from "./message"

export type ChatViewProps = {
  chatId: string
  isNew: boolean
  messages: NajimiUIMessage[]
  status: "idle" | "generating" | "waiting"
  turnStartedAt: string | null
  personId: string | null
  mode: Mode
  people: ChatPerson[]
  starters: string[]
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
  const [personId, setPersonId] = useState(props.personId)
  const [mode, setMode] = useState<Mode>(props.mode)
  const [started, setStarted] = useState(!props.isNew)
  const [compareFor, setCompareFor] = useState<NajimiUIMessage | null>(null)
  const chat = useNajimiChat(props.chatId, props.messages, personId)
  const { messages, status, sendMessage, stop, regenerate, addToolOutput } = chat
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

  const send = (text: string, photos: Uploaded[] = []) => {
    if (!started) {
      // The URL becomes the chat's own as soon as it has a first message.
      window.history.replaceState(null, "", `/c/${props.chatId}`)
      setStarted(true)
    }
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
  const changePerson = async (id: string) => {
    setPersonId(id)
    if (started)
      await api(`/api/chats/${props.chatId}`, { method: "PATCH", json: { personId: id } }).catch(
        () => undefined,
      )
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")

  return (
    <div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col px-4 md:px-6">
      {messages.length === 0 ? (
        <section className="flex flex-1 flex-col justify-center gap-6 py-10">
          <h1 className="font-title text-title-sm">
            {t("greeting", { name: props.greetingName })}
          </h1>
          <div className="flex flex-wrap gap-2">
            {props.starters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-pill border border-foreground/15 px-4 py-2 text-start text-sm transition-colors hover:border-lime hover:text-lime"
              >
                {s}
              </button>
            ))}
          </div>
        </section>
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
                  }}
                />
                {m.role === "assistant" && !(busy && isLast) && textOf(m) ? (
                  <div className="flex items-center gap-1 text-text-3">
                    <IconButton
                      label={t("copy")}
                      onClick={() =>
                        navigator.clipboard.writeText(textOf(m)).then(() => toast(t("copied")))
                      }
                    >
                      <Copy className="size-4" />
                    </IconButton>
                    {m.id === lastAssistant?.id ? (
                      <IconButton
                        label={t("regenerate")}
                        onClick={() => void regenerate({ messageId: m.id })}
                      >
                        <RotateCcw className="size-4" />
                      </IconButton>
                    ) : null}
                    <IconButton
                      label={t("fork")}
                      onClick={async () => {
                        const { chatId } = await api<{ chatId: string }>(
                          `/api/chats/${props.chatId}/fork`,
                          { json: { messageId: m.id } },
                        )
                        router.push(`/c/${chatId}`)
                      }}
                    >
                      <GitFork className="size-4" />
                    </IconButton>
                    <button
                      type="button"
                      onClick={() => setCompareFor(m)}
                      className="ms-1 inline-flex items-center gap-1.5 rounded-pill border border-foreground/15 px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:border-lime hover:text-lime"
                    >
                      <Scale className="size-3.5" /> {t("compare")}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
          {stillRunning ? (
            <p className="flex items-center gap-2 text-sm text-text-3">
              <span className="size-2 animate-lime-pulse rounded-full bg-lime" />{" "}
              {t("stillWorking")}
            </p>
          ) : null}
          {stale || chat.error ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-destructive">{stale ? t("interrupted") : t("error")}</span>
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
      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Composer
          people={props.people}
          personId={personId}
          onPerson={changePerson}
          mode={mode}
          onMode={changeMode}
          busy={busy}
          onSend={send}
          onStop={() => void stop()}
        />
      </div>
      <CompareDialog
        chatId={props.chatId}
        message={compareFor}
        onClose={() => setCompareFor(null)}
      />
    </div>
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

/**
 * Compare without taste (C13): the same ask answered with no taste and no Qloo, beside Najimi's
 * answer and the cards Qloo made possible.
 */
function CompareDialog({
  chatId,
  message,
  onClose,
}: {
  chatId: string
  message: NajimiUIMessage | null
  onClose: () => void
}) {
  const t = useTranslations("Chat")
  const [generic, setGeneric] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setGeneric(message?.metadata?.compare?.generic ?? null)
    setError(null)
    if (!message || message.metadata?.compare) return
    api<{ generic: string }>(`/api/chats/${chatId}/compare`, { json: { messageId: message.id } })
      .then((r) => setGeneric(r.generic))
      .catch((e) => setError(e instanceof Error ? e.message : ""))
  }, [chatId, message])
  const cards = (message?.parts ?? []).flatMap((p) =>
    p.type === "tool-qlooInsights" && p.state === "output-available"
      ? [{ title: p.output.title, items: (p.output.picks ?? []).map((x) => x.name).slice(0, 4) }]
      : [],
  )
  return (
    <Dialog open={Boolean(message)} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[85svh] max-w-4xl overflow-y-auto rounded-sheet border-0 bg-background p-5 sm:max-w-4xl">
        <DialogTitle className="font-title text-2xl">{t("compareTitle")}</DialogTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-card border border-dashed border-foreground/25 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-text-3 uppercase">
              {t("withoutTaste")}
            </p>
            {generic ? (
              <div className="text-sm leading-relaxed text-text-2">
                <Streamdown>{generic}</Streamdown>
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-text-3">
                <span className="size-2 animate-lime-pulse rounded-full bg-lime" /> {t("asking")}
              </p>
            )}
          </section>
          <section className="flex flex-col gap-3 rounded-card bg-card p-4 text-card-foreground shadow-paper">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
              <span className="size-1.5 rounded-full bg-lime-ink" /> {t("withTaste")}
            </p>
            {message ? (
              <div className="text-sm leading-relaxed">
                <Streamdown>{textOf(message)}</Streamdown>
              </div>
            ) : null}
            {cards.length ? (
              <ul className="flex flex-col gap-1.5 border-t border-paper-foreground/10 pt-3 text-sm">
                {cards.map((c) => (
                  <li key={c.title}>
                    <span className="font-semibold">{c.title}</span>
                    {c.items.length ? (
                      <span className="text-paper-muted"> — {c.items.join(", ")}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
