"use client"

import type { NajimiUIMessage, Screen } from "@najimi/agent"
import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/lib/fetcher"
import { callsNajimi, type RoomKind } from "@/lib/mention"

export type RoomStatus = "idle" | "generating" | "waiting" | "stopping"

/** Fired on the window when someone in the room finishes a game (its cards refresh their board). */
export const GAME_PLAYED = "najimi:game-played"

/** A short random id for a message (the server keeps the first copy of a resend). */
const newId = () =>
  `msg_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(36).padStart(2, "0"),
  )
    .join("")
    .slice(0, 18)}`

/**
 * A room, live (W6): its messages, kept in step over the room's event stream (every message as
 * it's written or changes, replayed after a dropped connection), and what you can do in it. What
 * you send shows at once; Najimi's answer streams in for everyone in the room.
 */
export function useRoom({
  chatId,
  initial,
  initialStatus,
  after,
  me,
  kind = "agent",
  onTitle,
}: {
  chatId: string
  initial: NajimiUIMessage[]
  initialStatus: RoomStatus
  /** The room's newest event when the page was made: the stream starts after it. */
  after: number
  me: string
  /** In a circle or DM only a message that calls Najimi starts a turn; anything else is just said. */
  kind?: RoomKind
  onTitle?: (title: string) => void
}) {
  const [messages, setMessages] = useState(initial)
  const [status, setStatus] = useState<RoomStatus>(initialStatus)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(initial.length > 0)
  const titleRef = useRef(onTitle)
  titleRef.current = onTitle

  const upsert = useCallback((message: NajimiUIMessage) => {
    setMessages((list) => {
      const at = list.findIndex((m) => m.id === message.id)
      if (at === -1) return [...list, message]
      const next = list.slice()
      next[at] = message
      return next
    })
  }, [])

  // A new conversation has no room until its first message; the stream starts then.
  useEffect(() => {
    if (!live) return
    const source = new EventSource(`/api/rooms/${chatId}/live?after=${after}`)
    source.onmessage = (event: MessageEvent<string>) => {
      const { type, data } = JSON.parse(event.data) as {
        type: string
        data: Record<string, unknown>
      }
      if (type === "message") upsert(data.message as NajimiUIMessage)
      else if (type === "status") setStatus(data.status as RoomStatus)
      else if (type === "removed")
        setMessages((list) => list.filter((m) => m.id !== (data.id as string)))
      else if (type === "title") titleRef.current?.(data.title as string)
      else if (type === "game") window.dispatchEvent(new CustomEvent(GAME_PLAYED, { detail: data }))
    }
    return () => source.close()
  }, [live, chatId, after, upsert])

  const send = useCallback(
    async (text: string, files: { url: string }[] = [], screen?: Screen) => {
      const id = newId()
      setError(null)
      upsert({
        id,
        role: "user",
        parts: [
          ...files.map((f) => ({
            type: "file" as const,
            mediaType: "image/jpeg",
            url: f.url,
            filename: "photo.jpg",
          })),
          ...(text ? [{ type: "text" as const, text }] : []),
        ],
        metadata: {
          authorId: me,
          createdAt: Date.now(),
          status: "done",
          ...(screen ? { screen } : {}),
        },
      })
      const answering = callsNajimi(kind, text)
      if (answering) setStatus("generating")
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const sent = await api<{ answers?: boolean }>(`/api/rooms/${chatId}/messages`, {
          json: { id, text, files, screen, tz },
        })
        // The server has the last word on whether Najimi answers (it may not, e.g. out of turns).
        if (sent.answers === false) setStatus((s) => (s === "generating" ? "idle" : s))
        setLive(true)
      } catch (e) {
        setMessages((list) => list.filter((m) => m.id !== id))
        setStatus("idle")
        setError(e instanceof Error ? e.message : "Something went wrong")
        return false
      }
      return true
    },
    [chatId, me, kind, upsert],
  )

  const answer = useCallback(
    async (messageId: string, toolCallId: string, output: unknown) => {
      await api(`/api/rooms/${chatId}/answer`, {
        json: { messageId, answer: { toolCallId, output } },
      }).catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"))
    },
    [chatId],
  )

  const approve = useCallback(
    async (messageId: string, approvalId: string, approved: boolean) => {
      await api(`/api/rooms/${chatId}/answer`, {
        json: { messageId, approval: { id: approvalId, approved } },
      }).catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"))
    },
    [chatId],
  )

  const stop = useCallback(async () => {
    setStatus("stopping")
    await api(`/api/rooms/${chatId}/stop`, { json: {} }).catch(() => null)
  }, [chatId])

  const retry = useCallback(async () => {
    setError(null)
    setStatus("generating")
    await api(`/api/rooms/${chatId}/retry`, { json: {} }).catch((e) => {
      setStatus("idle")
      setError(e instanceof Error ? e.message : "Something went wrong")
    })
  }, [chatId])

  const last = messages.at(-1)
  const busy =
    status === "generating" ||
    status === "stopping" ||
    last?.metadata?.status === "streaming" ||
    last?.metadata?.status === "resume"
  // What's on screen counts as read (their unread count in Chats), a moment after it arrives and
  // only while the page is in front.
  const count = messages.length
  useEffect(() => {
    if (!count) return
    const mark = () => {
      if (document.visibilityState === "visible")
        void api(`/api/rooms/${chatId}/read`, { method: "POST" }).catch(() => null)
    }
    const timer = setTimeout(mark, 1200)
    document.addEventListener("visibilitychange", mark)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", mark)
    }
  }, [chatId, count])

  return { messages, status, busy, error, send, answer, approve, stop, retry }
}
