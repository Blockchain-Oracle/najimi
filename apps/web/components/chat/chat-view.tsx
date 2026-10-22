"use client"

import type { NajimiUIMessage } from "@najimi/agent"
import { AGENT } from "@najimi/config"
import { Dialog, DialogContent, DialogTitle } from "@najimi/ui/components/dialog"
import { toast } from "@najimi/ui/components/sonner"
import { useQueryClient } from "@tanstack/react-query"
import { BookmarkPlus, Copy, GitFork, RotateCcw, Scale, Share2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { Streamdown } from "streamdown"
import { SaveWorkflowDialog } from "@/components/workflows/save-workflow-dialog"
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
  personId: string | null
  mode: Mode
  people: ChatPerson[]
  starters: Starter[]
  /** The taste an empty chat says it will use. */
  taste: WelcomeTaste
  greetingName: string
  /** A workflow a new chat starts with (from the library or a shared link). */
  workflow?: string | null
  /** A saved workflow's opening message: its steps, sent as the person's own words. */
  workflowStart?: string | null
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
  const [saving, setSaving] = useState(false)
  const tw = useTranslations("Workflows")
  const [workflow, setWorkflow] = useState<string | null>(props.workflow ?? null)
  const chat = useNajimiChat(props.chatId, props.messages, personId, workflow)
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

  // A workflow chat opens with its first message. The timer is cleared if the view unmounts first
  // (React's development double-mount), so the message goes exactly once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when a new workflow chat mounts
  useEffect(() => {
    if (!props.isNew || !props.workflow) return
    const opening =
      props.workflowStart ?? tw(`items.${props.workflow}.start` as "items.night-in.start")
    const timer = setTimeout(() => send(opening), 0)
    return () => clearTimeout(timer)
  }, [])

  const runWorkflow = (slug: string) => {
    if (messages.length === 0) {
      setWorkflow(slug)
      setTimeout(() => send(tw(`items.${slug}.start` as "items.night-in.start")), 0)
    } else router.push(`/c?workflow=${slug}`)
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
    <ChatProvider value={{ chatId: props.chatId, people: props.people }}>
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col px-4 md:px-6">
        {messages.length === 0 ? (
          <ChatWelcome
            person={props.people.find((p) => p.id === personId)}
            greeting={t("greeting", { name: props.greetingName })}
            taste={props.taste}
            starters={props.starters}
            onAsk={(text) => send(text)}
            onWorkflow={runWorkflow}
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
                      {m.id === lastAssistant?.id ? (
                        // The last reply names its actions: a phone has no hover to explain an icon.
                        <>
                          <PillButton onClick={() => void shareChat(props.chatId, t("linkCopied"))}>
                            <Share2 className="size-3.5" /> {t("share")}
                          </PillButton>
                          <PillButton onClick={() => setSaving(true)}>
                            <BookmarkPlus className="size-3.5" /> {t("saveWorkflow")}
                          </PillButton>
                        </>
                      ) : (
                        <IconButton
                          label={t("shareChat")}
                          onClick={() => void shareChat(props.chatId, t("linkCopied"))}
                        >
                          <Share2 className="size-4" />
                        </IconButton>
                      )}
                      <PillButton onClick={() => setCompareFor(m)}>
                        <Scale className="size-3.5" /> {t("compare")}
                      </PillButton>
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
        <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
          <Composer
            people={props.people}
            personId={personId}
            onPerson={changePerson}
            mode={mode}
            onMode={changeMode}
            busy={busy}
            onSend={send}
            onStop={() => void stop()}
            onWorkflow={runWorkflow}
            ideas={props.starters.map((s) => s.text)}
          />
        </div>
        <SaveWorkflowDialog
          chatId={props.chatId}
          version={messages.length}
          open={saving}
          onOpenChange={setSaving}
        />
        <CompareDialog
          chatId={props.chatId}
          message={compareFor}
          onClose={() => setCompareFor(null)}
        />
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
                <span className="size-2 animate-signal-pulse rounded-full bg-signal" />{" "}
                {t("asking")}
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
