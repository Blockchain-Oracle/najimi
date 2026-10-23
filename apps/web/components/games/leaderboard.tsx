"use client"

import { Orb } from "@najimi/ui/components/orb"
import { cn } from "@najimi/ui/lib/utils"
import { Crown } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { ProfileLink } from "@/components/people/profile-link"
import { Face } from "@/components/taste/face"
import { NumberTicker } from "./number-ticker"

/*
 * A leaderboard: the top three on a podium, everyone else in rows, your row marked (and pinned
 * at the bottom when you're further down). Adapted from trophy.so's Leaderboard Podium and Card
 * (21st.dev trophyso/leaderboard-podium, leaderboard-card): the 2-1-3 order, the crown, the
 * stepped blocks with the rank on top. Changed here: faces and Najimi's orb for avatars, blocks
 * that rise in turn, one accent (first place glows), scores that count up.
 */

export type BoardEntry = {
  key: string
  name: string
  look: string | null
  score: number
  username?: string | null
  najimi?: boolean
  me?: boolean
  /** A short line under the name (games played, a streak). */
  sub?: string
}

const STEP = {
  1: "h-28 bg-signal text-signal-foreground shadow-[0_0_48px_-8px_var(--color-signal)]",
  2: "h-20 bg-foreground/14",
  3: "h-14 bg-foreground/8",
} as const

function Avatar({ entry, size }: { entry: BoardEntry; size: "sm" | "md" | "lg" }) {
  if (entry.najimi) return <Orb size={size === "lg" ? 64 : size === "md" ? 48 : 32} />
  return <Face look={entry.look} name={entry.name} size={size} />
}

export function Podium({ entries, you }: { entries: BoardEntry[]; you: string }) {
  const still = useReducedMotion()
  const order = [entries[1], entries[0], entries[2]]
  return (
    <ol className="flex items-end justify-center gap-3" aria-label="Top three">
      {order.map((entry, i) => {
        // biome-ignore lint/suspicious/noArrayIndexKey: an empty podium step keeps its place
        if (!entry) return <li key={`empty-${i}`} className="w-24" />
        const rank = (i === 1 ? 1 : i === 0 ? 2 : 3) as 1 | 2 | 3
        return (
          <li key={entry.key} className="flex w-24 flex-col items-center gap-1.5">
            <ProfileLink username={entry.me ? null : entry.username} className="relative">
              <span
                className={cn("block rounded-full", entry.me && "ring-2 ring-signal ring-offset-2")}
              >
                <Avatar entry={entry} size={rank === 1 ? "lg" : "md"} />
              </span>
              {rank === 1 ? (
                <Crown
                  aria-hidden
                  className="absolute -top-4 start-1/2 size-5 -translate-x-1/2 fill-signal text-signal rtl:translate-x-1/2"
                />
              ) : null}
            </ProfileLink>
            <ProfileLink
              username={entry.me ? null : entry.username}
              className="max-w-full truncate text-[13px] font-semibold"
            >
              {entry.me ? you : entry.name}
            </ProfileLink>
            <motion.span
              initial={still ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 20, delay: 0.15 * (3 - rank) }}
              style={{ originY: 1 }}
              className={cn(
                "flex w-full flex-col items-center justify-start gap-0.5 rounded-t-tile pt-2",
                STEP[rank],
              )}
            >
              <span className="font-title text-[18px] leading-none">
                <NumberTicker value={entry.score} delay={0.2 * (3 - rank)} />
              </span>
              <span className="text-[11px] font-bold opacity-70">{rank}</span>
            </motion.span>
          </li>
        )
      })}
    </ol>
  )
}

function Row({ entry, rank, you }: { entry: BoardEntry; rank: number; you: string }) {
  const body = (
    <>
      <span className="w-5 text-center text-[13px] font-bold text-text-3 tabular-nums">{rank}</span>
      <Avatar entry={entry} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold">{entry.me ? you : entry.name}</span>
        {entry.sub ? <span className="truncate text-[12px] text-text-3">{entry.sub}</span> : null}
      </span>
      <span className="font-heading text-[15px] tabular-nums">{entry.score.toLocaleString()}</span>
    </>
  )
  const cls = cn(
    "flex items-center gap-3 rounded-tile px-3 py-2.5",
    entry.me ? "bg-signal-soft ring-1 ring-signal/40" : "bg-foreground/[0.04]",
  )
  return (
    <li>
      {entry.username && !entry.me ? (
        <Link href={`/u/${entry.username}`} className={cn(cls, "hover:bg-foreground/[0.08]")}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}

/** The whole board: podium for the top three, rows below, your row pinned if it's past `limit`. */
export function Leaderboard({
  entries,
  you,
  limit = 10,
  className,
}: {
  entries: BoardEntry[]
  /** How "you" reads in this language. */
  you: string
  limit?: number
  className?: string
}) {
  if (!entries.length) return null
  // A podium needs three; fewer read better as rows.
  const podium = entries.length >= 3
  const rest = entries.slice(podium ? 3 : 0, limit)
  const mine = entries.findIndex((e) => e.me)
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {podium ? <Podium entries={entries.slice(0, 3)} you={you} /> : null}
      {rest.length ? (
        <ol className="flex flex-col gap-1.5">
          {rest.map((entry, i) => (
            <Row key={entry.key} entry={entry} rank={i + (podium ? 4 : 1)} you={you} />
          ))}
        </ol>
      ) : null}
      {mine >= limit ? (
        <ol className="border-t border-line pt-3">
          <Row entry={entries[mine] as BoardEntry} rank={mine + 1} you={you} />
        </ol>
      ) : null}
    </div>
  )
}
