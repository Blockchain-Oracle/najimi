"use client"

import type { ConnectionView } from "@najimi/connectors/sessions"
import type { TuneUpItem } from "@najimi/db/schema"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { celebrate } from "@/components/games/confetti"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { type Platform, zone } from "./platforms"

export type SocialAction = {
  id: string
  platform: Platform
  kind: string
  target: string
  label: string | null
  status: "done" | "failed" | "skipped"
  detail: string | null
  url: string | null
  createdAt: string
}
export type Socials = {
  ready: { x: boolean; instagram: boolean }
  connections: ConnectionView[]
  actions: SocialAction[]
  after: number
}
export type Score = {
  id: string
  platform: Platform
  score: number
  matched: { qlooId: string; name: string; image: string | null; fit: number }[]
  off: string[]
  createdAt: string
}

/** Connected accounts, what Najimi did with them, and where the live stream starts. */
export function useSocials() {
  return useQuery({
    queryKey: ["socials"],
    queryFn: () => api<Socials>("/api/socials"),
    staleTime: 60_000,
  })
}

export function useScores() {
  return useQuery({
    queryKey: ["feedscores"],
    queryFn: () => api<{ scores: Score[] }>("/api/feedscore"),
  })
}

/** Today's tune-up, ticked off optimistically. */
export function useTuneUp() {
  const queryClient = useQueryClient()
  const today = useQuery({
    queryKey: ["tuneup"],
    queryFn: () =>
      api<{ day: string; items: TuneUpItem[] }>(`/api/tuneup?tz=${encodeURIComponent(zone())}`),
    staleTime: 10 * 60_000,
  })
  const items = today.data?.items ?? []
  const tick = async (item: TuneUpItem, value = true) => {
    if (!today.data) return
    const next = items.map((i) => (i.id === item.id ? { ...i, done: value } : i))
    queryClient.setQueryData(["tuneup"], { ...today.data, items: next })
    if (value) sound("check")
    if (value && next.every((i) => i.done)) void celebrate()
    await api("/api/tuneup", { json: { day: today.data.day, itemId: item.id, done: value } }).catch(
      () => queryClient.invalidateQueries({ queryKey: ["tuneup"] }),
    )
  }
  return { today, items, tick }
}

export type LiveState = { state: "running" | "done" | "failed"; url?: string; error?: string }

/** "Do it for me" as it happens: each follow's state, from the person's own live stream. */
export function useSocialLive(socials: Socials | undefined) {
  const queryClient = useQueryClient()
  const [live, setLive] = useState<Record<string, LiveState>>({})
  const after = socials?.after
  const watching = Boolean(socials?.connections.some((c) => c.autopilot))
  useEffect(() => {
    if (!watching || after === undefined) return
    const source = new EventSource(`/api/me/live?after=${after}`)
    source.onmessage = (e: MessageEvent<string>) => {
      const { type, data } = JSON.parse(e.data) as {
        type: string
        data: { itemId?: string; state?: string; url?: string; error?: string }
      }
      if (type !== "social") return
      const state = data.state
      if (data.itemId && (state === "running" || state === "done" || state === "failed")) {
        setLive((m) => ({
          ...m,
          [data.itemId as string]: { state, url: data.url, error: data.error },
        }))
        if (state === "done") sound("check")
      }
      if (state === "finished") {
        void queryClient.invalidateQueries({ queryKey: ["tuneup"] })
        void queryClient.invalidateQueries({ queryKey: ["socials"] })
      }
    }
    return () => source.close()
  }, [watching, after, queryClient])
  return live
}
