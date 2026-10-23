"use client"

import type { NajimiTools } from "@najimi/agent"
import type { PollTally } from "@najimi/agent/server"
import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BarChart3, Check } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { OpenThing } from "@/components/entity/entity-provider"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { POLL_VOTED } from "@/lib/use-room"
import { useChatId } from "../chat-context"

/*
 * A poll in the thread: the question, each choice as a bar that fills with its share and the
 * faces of who picked it, your own choice ticked. A tap votes (another tap changes it); every
 * vote reaches the room at once. After Turf's vote with avatars (Refero 4cccee1d). A choice that's
 * a thing from Qloo shows its art, which opens it.
 */

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

export function PollCard({ output }: { output: NajimiTools["startPoll"]["output"] }) {
  const t = useTranslations("Polls")
  const chatId = useChatId()
  const queryClient = useQueryClient()
  const key = ["poll", output.pollId]
  const tally = useQuery({
    queryKey: key,
    queryFn: () => api<PollTally>(`/api/rooms/${chatId}/polls/${output.pollId}`),
    enabled: Boolean(chatId),
    staleTime: 15_000,
  })

  // Someone voted: the tally refreshes.
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<{ pollId: string }>).detail?.pollId === output.pollId)
        void queryClient.invalidateQueries({ queryKey: ["poll", output.pollId] })
    }
    window.addEventListener(POLL_VOTED, on)
    return () => window.removeEventListener(POLL_VOTED, on)
  }, [output.pollId, queryClient])

  const data = tally.data
  const options = data?.options ?? output.options.map((o) => ({ ...o, count: 0, voters: [] }))
  const total = data?.total ?? 0
  const lead = Math.max(0, ...options.map((o) => o.count))

  const vote = async (optionId: string) => {
    if (!chatId || data?.closed || data?.mine === optionId) return
    // The tick moves at once; the count follows from the server.
    queryClient.setQueryData<PollTally>(key, (d) => (d ? { ...d, mine: optionId } : d))
    try {
      await api(`/api/rooms/${chatId}/polls/${output.pollId}/vote`, { json: { optionId } })
      await queryClient.invalidateQueries({ queryKey: key })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
      await queryClient.invalidateQueries({ queryKey: key })
    }
  }

  return (
    <section className="flex animate-card-land flex-col gap-3 rounded-card bg-card p-4">
      <header className="flex items-center gap-2 text-[12px] font-semibold text-text-3">
        <BarChart3 className="size-4" />
        <span className="tracking-[0.08em] uppercase">{t("poll")}</span>
        <span className="ms-auto flex items-center gap-1.5 normal-case">
          {data?.by ? (
            <>
              <Face look={data.by.look} name={data.by.name} size="xs" />
              {t("askedBy", { name: data.by.name })}
            </>
          ) : data ? (
            <>
              <Orb size={18} /> {t("askedBy", { name: "Najimi" })}
            </>
          ) : null}
        </span>
      </header>
      <h3 className="font-heading text-[17px] leading-snug">{output.question}</h3>
      <ul className="flex flex-col gap-2">
        {options.map((o) => {
          const share = total ? o.count / total : 0
          const mine = data?.mine === o.id
          const art = sized(o.image, 120)
          return (
            <li key={o.id} className="flex items-center gap-2">
              {art && o.qlooId ? (
                <OpenThing
                  thing={{
                    qlooId: o.qlooId,
                    type: "urn:entity:place",
                    name: o.label,
                    image: o.image ?? null,
                  }}
                  className="shrink-0 rounded-tile"
                >
                  {/* biome-ignore lint/performance/noImgElement: remote artwork thumbnail */}
                  <img src={art} alt="" className="size-11 rounded-tile object-cover" />
                </OpenThing>
              ) : null}
              <button
                type="button"
                onClick={() => void vote(o.id)}
                aria-pressed={mine}
                disabled={data?.closed}
                className={cn(
                  "relative isolate flex min-h-11 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-tile bg-white/[0.05] px-3 py-2 text-start transition-[box-shadow] active:scale-[0.99]",
                  mine && "ring-2 ring-[var(--color-aura-1)]",
                )}
              >
                {/* The share fills the row from the start; the winner wears the aura. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 start-0 -z-10 transition-[width] duration-500 ease-out",
                    o.count && o.count === lead
                      ? "bg-[linear-gradient(90deg,color-mix(in_oklab,var(--color-aura-1)_45%,transparent),color-mix(in_oklab,var(--color-aura-2)_35%,transparent))]"
                      : "bg-white/[0.08]",
                  )}
                  style={{ width: `${Math.round(share * 100)}%` }}
                />
                {mine ? <Check className="size-4 shrink-0 text-[var(--color-aura-1)]" /> : null}
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{o.label}</span>
                {o.voters.length ? (
                  <span className="flex shrink-0 -space-x-1.5">
                    {o.voters.slice(0, 3).map((v, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: voters can share a name
                      <span key={i} className="rounded-full ring-2 ring-card">
                        <Face look={v.look} name={v.name} size="xs" />
                      </span>
                    ))}
                  </span>
                ) : null}
                <span className="w-9 shrink-0 text-end text-[13px] font-semibold tabular-nums text-text-2">
                  {total ? `${Math.round(share * 100)}%` : ""}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[12px] text-text-3">
        {data?.closed ? t("closed") : total ? t("votes", { n: total }) : t("first")}
      </p>
    </section>
  )
}
