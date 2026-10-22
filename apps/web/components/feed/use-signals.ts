"use client"

import { FEED } from "@najimi/config"
import { useCallback, useEffect, useRef } from "react"

/*
 * What you do with cards goes to the server in small batches (every few seconds, and when the page
 * hides): seen, watched for a while, played. Loves, hides and keeps go at once, because they change
 * what comes next.
 */

export type Signal = {
  qlooId: string
  type: string
  kind: "seen" | "dwell" | "play" | "love" | "unlove" | "hide" | "save" | "unsave" | "open"
  value?: number
  name?: string
  image?: string | null
  surface?: "feed" | "player"
}

const URGENT = new Set<Signal["kind"]>(["love", "unlove", "hide", "save", "unsave"])

export type SignalResult = { retune?: boolean; full?: boolean }

export function useSignals(onSent?: (sent: Signal[], result: SignalResult) => void) {
  const queue = useRef<Signal[]>([])
  const sentRef = useRef(onSent)
  sentRef.current = onSent

  const flush = useCallback((beacon = false) => {
    if (!queue.current.length) return
    const batch = queue.current.splice(0, FEED.batchMax)
    const body = JSON.stringify({ signals: batch })
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/feed/signals", new Blob([body], { type: "application/json" }))
      return
    }
    void fetch("/api/feed/signals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => sentRef.current?.(batch, result ?? {}))
      .catch(() => null)
  }, [])

  const send = useCallback(
    (signal: Signal) => {
      queue.current.push(signal)
      if (URGENT.has(signal.kind) || queue.current.length >= FEED.batchMax) flush()
    },
    [flush],
  )

  useEffect(() => {
    const timer = setInterval(() => flush(), FEED.flushMs)
    const hide = () => {
      if (document.visibilityState === "hidden") flush(true)
    }
    document.addEventListener("visibilitychange", hide)
    window.addEventListener("pagehide", hide)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", hide)
      window.removeEventListener("pagehide", hide)
      flush(true)
    }
  }, [flush])

  return send
}
