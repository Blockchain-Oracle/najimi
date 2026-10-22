"use client"

import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { GameArt, GameTile } from "./game-art"
import { type BoardEntry, Leaderboard } from "./leaderboard"

/*
 * Games in a circle or a DM: deal one into the room (about whoever you pick), or see the room's
 * scores this week. The round's card lands in the thread for everyone, live.
 */

type Kind = "wavelength" | "knowme" | "twins" | "blind"
type Member = { userId: string; name: string; username: string | null; look: string | null }

export function GameSheet({
  open,
  onOpenChange,
  chatId,
  members,
  me,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
  members: Member[]
  me: string
  title: string
}) {
  const t = useTranslations("Games")
  const [tab, setTab] = useState<"deal" | "week">("deal")
  const [picking, setPicking] = useState<Kind | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const weekly = useQuery({
    queryKey: ["games-weekly", chatId],
    queryFn: () =>
      api<{
        board: {
          userId: string
          name: string
          look: string | null
          username: string | null
          points: number
          games: number
        }[]
        me: string
        art: string[]
      }>(`/api/games/board?chatId=${chatId}`),
    enabled: open,
  })

  const deal = async (kind: Kind, about?: string | null) => {
    setBusy(`${kind}:${about ?? ""}`)
    try {
      await api("/api/games", {
        json: { kind, chatId, ...(about ? { about } : {}) },
      })
      onOpenChange(false)
      setPicking(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setBusy(null)
    }
  }

  const kinds: { kind: Kind; who: boolean }[] = [
    { kind: "wavelength", who: true },
    { kind: "knowme", who: true },
    ...(members.length >= 2 ? [{ kind: "twins" as const, who: false }] : []),
    { kind: "blind", who: false },
  ]
  const art = weekly.data?.art ?? []

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setPicking(null)
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[88svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="font-title pt-5 text-[1.75rem] font-normal">
          {t("sheet.title", { name: title })}
        </SheetTitle>
        <div className="mt-3 grid grid-cols-2 rounded-pill bg-card p-1 text-[14px] font-semibold">
          {(["deal", "week"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "h-9 rounded-pill transition-colors",
                tab === k ? "bg-foreground text-background" : "text-text-2",
              )}
            >
              {k === "deal" ? t("sheet.deal") : t("thisWeek")}
            </button>
          ))}
        </div>

        {tab === "deal" ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {kinds.map((g, i) => (
                <GameTile
                  key={g.kind}
                  className="h-48"
                  title={t(`kinds.${g.kind}`)}
                  line={t(`sheet.${g.kind}`)}
                  wash={art[(i * 2) % Math.max(art.length, 1)] ?? null}
                  selected={picking === g.kind}
                  busy={Boolean(busy?.startsWith(`${g.kind}:`)) && !g.who}
                  onClick={() =>
                    g.who ? setPicking(picking === g.kind ? null : g.kind) : void deal(g.kind)
                  }
                >
                  <GameArt kind={g.kind} art={art} faces={members} label={t("dial")} />
                </GameTile>
              ))}
            </div>
            {picking ? (
              <div className="flex flex-col gap-3 rounded-card bg-card p-4">
                <span className="font-heading text-[15px]">{t("sheet.aboutWho")}</span>
                <div className="flex flex-wrap gap-4">
                  {members.map((m) => {
                    const key = `${picking}:${m.username ?? ""}`
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        disabled={busy !== null || !m.username}
                        onClick={() => void deal(picking, m.username)}
                        className="flex w-16 flex-col items-center gap-1.5 disabled:opacity-50"
                      >
                        <span className="relative rounded-full ring-2 ring-transparent transition-[box-shadow] hover:ring-signal">
                          <Face look={m.look} name={m.name} size="lg" />
                          {busy === key ? (
                            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
                              <Loader2 className="size-5 animate-spin text-white" />
                            </span>
                          ) : null}
                        </span>
                        <span className="w-full truncate text-center text-[12px] font-semibold">
                          {m.userId === me ? t("you") : m.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : weekly.isPending ? (
          <Loader2 className="mx-auto mt-8 size-5 animate-spin text-text-3" />
        ) : weekly.data?.board.length ? (
          <Leaderboard
            className="mt-5"
            you={t("you")}
            entries={weekly.data.board.map(
              (r): BoardEntry => ({
                key: r.userId,
                name: r.name,
                look: r.look,
                username: r.username,
                score: r.points,
                me: r.userId === me,
                sub: t("games", { count: r.games }),
              }),
            )}
          />
        ) : (
          <p className="mt-6 text-[15px] text-text-3">{t("sheet.noScores")}</p>
        )}
      </SheetContent>
    </Sheet>
  )
}
