"use client"

import { GAMES } from "@najimi/config"
import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Flame, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"
import { GameArt, GameTile } from "./game-art"
import { type BoardEntry, Leaderboard } from "./leaderboard"

/*
 * The arcade on People (W9): games made from your own taste's artwork (send your wavelength to
 * friends, let Qloo read you blind, quiz people on your loves, join the Lounge), your streak, how
 * often Qloo was right about you, and this week's leaderboard. After Duolingo's quests and
 * leagues (Refero 0966d27a, 9e82bb9c) and Brilliant's daily streak (c118f203).
 */

type Weekly = {
  board: {
    userId: string
    name: string
    look: string | null
    username: string | null
    points: number
    games: number
  }[]
  me: string
  streak: number
  qloo: { percent: number; total: number } | null
}

export function PlaySection({
  art,
  lounge,
}: {
  /** Your own taste's artwork. */
  art: string[]
  lounge: { id: string; member: boolean; members: number } | null
}) {
  const t = useTranslations("Games")
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const weekly = useQuery({
    queryKey: ["games-weekly"],
    queryFn: () => api<Weekly>("/api/games/board"),
  })

  const start = async (kind: "wavelength" | "knowme" | "blind") => {
    setBusy(kind)
    try {
      const { token } = await api<{ token: string }>("/api/games", { json: { kind } })
      router.push(`/play/${token}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
      setBusy(null)
    }
  }

  const a = (i: number) => art[i % Math.max(art.length, 1)] ?? null
  const streak = weekly.data?.streak ?? 0
  const qloo = weekly.data?.qloo

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-[17px]">{t("arcade")}</h2>
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <span
            className={cn(
              "flex items-center gap-1 rounded-pill px-2.5 py-1",
              streak ? "bg-signal-soft text-signal" : "bg-card text-text-3",
            )}
            title={t("streakHint")}
          >
            <Flame className={cn("size-4", streak && "fill-current")} />
            {streak}
          </span>
          {qloo ? (
            <span
              className="flex items-center gap-1 rounded-pill bg-card px-2.5 py-1"
              title={t("qlooHint")}
            >
              <Sparkles className="size-4 text-signal" />
              {t("qlooRight", { percent: qloo.percent })}
            </span>
          ) : null}
        </span>
      </div>

      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
        {(["wavelength", "blind", "knowme"] as const).map((kind, i) => (
          <GameTile
            key={kind}
            className="h-52 w-40 shrink-0 snap-start"
            title={t(`tiles.${kind}`)}
            line={t(`tiles.${kind}Line`)}
            wash={a(i * 2)}
            busy={busy === kind}
            onClick={() => void start(kind)}
          >
            <GameArt kind={kind} art={art} label={t("dial")} />
          </GameTile>
        ))}
        {lounge ? (
          <GameTile
            className="h-52 w-40 shrink-0 snap-start"
            title={t("tiles.lounge")}
            line={t("tiles.loungeLine", { count: lounge.members })}
            wash={a(7)}
            onClick={() =>
              router.push(lounge.member ? `/c/${lounge.id}` : `/join/${GAMES.lounge.token}`)
            }
          >
            <Orb size={84} />
          </GameTile>
        ) : null}
      </div>

      {weekly.data?.board.length ? (
        <div className="mt-2 flex flex-col gap-3 rounded-card bg-card p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="font-heading text-[15px]">{t("thisWeek")}</h3>
            <span className="text-[12px] text-text-3">{t("weekHint")}</span>
          </div>
          <Leaderboard
            you={t("you")}
            entries={weekly.data.board.map(
              (r): BoardEntry => ({
                key: r.userId,
                name: r.name,
                look: r.look,
                username: r.username,
                score: r.points,
                me: r.userId === weekly.data?.me,
                sub: t("games", { count: r.games }),
              }),
            )}
          />
        </div>
      ) : null}
    </section>
  )
}
