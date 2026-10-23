"use client"

import type { NajimiTools } from "@najimi/agent"
import type { BoardRow, RoundView } from "@najimi/games/round"
import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link2, Play, Trophy } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { GAME_PLAYED } from "@/lib/use-room"

/*
 * A game dropped into the thread: the round's hand of artwork, who it's about against Najimi, a
 * Play button and the challenge link, and the round's scoreboard, live (it refreshes the moment
 * anyone in the room finishes).
 */

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

export function GameCard({ output }: { output: NajimiTools["startGame"]["output"] }) {
  const t = useTranslations("Games")
  const queryClient = useQueryClient()
  const token = output.token
  const view = useQuery({
    queryKey: ["game-view", token],
    queryFn: () => api<RoundView>(`/api/play/${token}`),
    enabled: Boolean(token),
    staleTime: 30_000,
  })
  const board = useQuery({
    queryKey: ["game-board", token],
    queryFn: () => api<{ board: BoardRow[] }>(`/api/play/${token}/board`),
    enabled: Boolean(token),
    staleTime: 30_000,
  })
  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["game-board", token] })
      void queryClient.invalidateQueries({ queryKey: ["game-view", token] })
    }
    window.addEventListener(GAME_PLAYED, refresh)
    window.addEventListener("focus", refresh)
    return () => {
      window.removeEventListener(GAME_PLAYED, refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [queryClient, token])

  if (!token)
    return (
      <p className="rounded-card bg-card px-4 py-3 text-sm text-text-2">
        {output.note ?? t("error")}
      </p>
    )

  const pictures = (view.data?.items ?? [])
    .map((it) => sized(it.image ?? it.options?.find((o) => o.image)?.image ?? null, 160))
    .filter((u): u is string => Boolean(u))
    .slice(0, 5)
  const done = view.data?.done ?? false
  const rows = (board.data?.board ?? []).slice(0, 4)
  const played = (board.data?.board ?? []).filter((r) => !r.najimi).length

  const copy = async () => {
    const url = `${window.location.origin}/play/${token}`
    await navigator.clipboard.writeText(url).catch(() => undefined)
    toast(t("copied"), { description: url })
  }

  return (
    <section className="dark relative isolate flex flex-col gap-4 overflow-hidden rounded-card bg-[#0b0b0d] p-4 text-foreground ring-1 ring-white/10">
      {pictures[0] ? (
        // biome-ignore lint/performance/noImgElement: remote artwork, blurred as a wash
        <img
          src={pictures[0]}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 size-full scale-150 object-cover opacity-40 blur-2xl saturate-150"
        />
      ) : null}
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-bold tracking-[0.08em] text-signal uppercase">
            {output.note ?? t("game")}
          </span>
          <h3 className="font-title text-[22px] leading-tight">{output.title}</h3>
          {output.subject ? (
            <span className="flex items-center gap-1.5 text-[13px] text-text-2">
              <Face look={output.subject.look} name={output.subject.name} size="xs" />
              {t("about", { name: output.subject.name })}
              <span className="text-text-4">·</span>
              {t("things", { count: output.count })}
            </span>
          ) : (
            <span className="text-[13px] text-text-2">{t("things", { count: output.count })}</span>
          )}
        </div>
        <span className="flex h-20 shrink-0 items-end" aria-hidden>
          {pictures.map((src, i) => (
            // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
            <img
              key={src}
              src={src}
              alt=""
              className="-ms-6 h-16 w-12 rounded-tile object-cover shadow-float ring-1 ring-white/15 first:ms-0"
              style={{
                transform: `rotate(${(i - (pictures.length - 1) / 2) * 9}deg) translateY(${Math.abs(i - (pictures.length - 1) / 2) * 3}px)`,
              }}
            />
          ))}
        </span>
      </header>

      {rows.length && !played ? (
        <p className="flex items-center gap-2 text-[13px] text-text-2">
          <Orb size={22} />
          {t("toBeat", { score: rows.find((r) => r.najimi)?.score ?? 0 })}
        </p>
      ) : rows.length ? (
        <ol className="flex flex-col gap-1">
          {rows.map((r, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: guests can share a name; rank is stable
              key={`${r.najimi ? "najimi" : (r.username ?? r.name)}-${i}`}
              className={cn(
                "flex items-center gap-2.5 rounded-tile px-2 py-1.5",
                r.me ? "bg-signal-soft" : "bg-white/[0.04]",
              )}
            >
              <span className="w-4 text-center text-[12px] font-bold text-text-3">
                {i === 0 && played ? <Trophy className="size-3.5 text-signal" /> : i + 1}
              </span>
              {r.najimi ? <Orb size={24} /> : <Face look={r.look} name={r.name} size="xs" />}
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {r.me ? t("you") : r.name}
              </span>
              <span className="font-heading text-[14px] tabular-nums">{r.score}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex gap-2">
        <Link
          href={`/play/${token}`}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-pill bg-foreground font-heading text-[15px] text-background transition-transform active:scale-[0.98]"
        >
          {done ? <Trophy className="size-4" /> : <Play className="size-4 fill-current" />}
          {done ? t("seeScores") : t("play")}
        </Link>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={t("copyLink")}
          title={t("copyLink")}
          className="glass grid size-11 place-items-center rounded-full"
        >
          <Link2 className="size-4" />
        </button>
      </div>
    </section>
  )
}
