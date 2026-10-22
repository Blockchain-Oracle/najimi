"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { type Hit, ReviewHits } from "./review-hits"
import { type Task, TaskList } from "./task-list"

type Read = {
  label: string
  counts: { following: number; posts: number }
  candidates: unknown[]
  texts: string[]
}

/**
 * Reads an X or Instagram account (your own connected one, or a public handle) and shows each step
 * as it really happens: the platform read; the things named in its posts (read by the light model)
 * while the accounts are matched; the Qloo match; then the review.
 */
export function SocialRead({
  platform,
  handle,
  personId,
  onDone,
}: {
  platform: "x" | "instagram"
  handle?: string | null
  personId: string
  onDone: () => void
}) {
  const t = useTranslations("Connect")
  const [read, setRead] = useState<Read | null>(null)
  const [named, setNamed] = useState<number | null>(null)
  const [tried, setTried] = useState(0)
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [error, setError] = useState<{ at: "read" | "match"; message: string } | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const match = (candidates: unknown[]) =>
      candidates.length
        ? api<{ hits: Hit[] }>("/api/imports/export", { json: { platform, candidates } }).then(
            (r) => r.hits,
          )
        : Promise.resolve([] as Hit[])
    void (async () => {
      let got: Read
      try {
        got = await api<Read>(`/api/socials/${platform}/read`, {
          json: handle ? { handle } : {},
        })
        setRead(got)
        setTried(got.candidates.length)
      } catch (e) {
        setError({ at: "read", message: e instanceof Error ? e.message : t("error") })
        return
      }
      try {
        // Accounts are matched while the posts are read for what they name.
        const [fromAccounts, fromPosts] = await Promise.all([
          match(got.candidates),
          (got.texts.length
            ? api<{ candidates: unknown[] }>("/api/socials/named", {
                json: { platform: platform === "x" ? "X" : "Instagram", texts: got.texts },
              })
            : Promise.resolve({ candidates: [] as unknown[] })
          ).then((r) => {
            setNamed(r.candidates.length)
            setTried((n) => n + r.candidates.length)
            return match(r.candidates)
          }),
        ])
        const all = new Map([...fromAccounts, ...fromPosts].map((h) => [h.qlooId, h]))
        setHits([...all.values()])
        if (all.size) sound("promote")
      } catch (e) {
        setError({ at: "match", message: e instanceof Error ? e.message : t("error") })
      }
    })()
  }, [platform, handle, t])

  const name = platform === "x" ? "X" : "Instagram"
  const counted = read
    ? [
        read.counts.following ? t("countFollowing", { count: read.counts.following }) : null,
        read.counts.posts ? t("countPosts", { count: read.counts.posts }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null
  const tasks: Task[] = [
    {
      id: "read",
      label: handle
        ? t("stepReadHandle", { handle: handle.replace(/^@/, ""), name })
        : t("stepReadOwn", { name }),
      note: error?.at === "read" ? null : counted,
      status: error?.at === "read" ? "failed" : read ? "done" : "running",
    },
    {
      id: "named",
      label: t("stepNamed"),
      note: named === null ? null : t("stepNamedCount", { count: named }),
      status: named !== null ? "done" : read ? "running" : "pending",
    },
    {
      id: "match",
      label: t("stepMatch", { count: tried }),
      note: hits ? t("stepMatched", { count: hits.length }) : null,
      status: error?.at === "match" ? "failed" : hits ? "done" : read ? "running" : "pending",
    },
    {
      id: "keep",
      label: t("stepKeep"),
      status: hits?.length ? "running" : "pending",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <TaskList tasks={tasks} label={read?.label ?? undefined} />
      {error ? <p className="text-[13px] text-danger">{error.message}</p> : null}
      {hits ? <ReviewHits personId={personId} hits={hits} onAdded={onDone} /> : null}
    </div>
  )
}
