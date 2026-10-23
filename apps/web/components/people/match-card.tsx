"use client"

import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { OpenThing } from "@/components/entity/entity-provider"
import { api } from "@/lib/fetcher"
import { AuraFace, type PersonCard } from "./person-row"

type Match = {
  percent: number
  words: string[]
  loves: { qlooId: string; name: string; image: string | null; type?: string }[]
  callId: string | null
} | null

/*
 * How your taste and theirs meet (after 222's overlap and Airbuds' compatibility, Refero 00ade516,
 * 1904948a): both faces, one big number from Qloo's compare, the loves you share, and the taste
 * words you both are.
 */
export function MatchCard({
  username,
  me,
  them,
}: {
  username: string
  me: Pick<PersonCard, "name" | "look" | "aura">
  them: Pick<PersonCard, "name" | "look" | "aura">
}) {
  const t = useTranslations("Social")
  const match = useQuery({
    queryKey: ["match", username],
    queryFn: () => api<{ match: Match }>(`/api/u/${username}/match`),
    staleTime: 10 * 60 * 1000,
  })
  const m = match.data?.match
  return (
    <section className="flex flex-col gap-5 overflow-hidden rounded-card bg-card p-5">
      <div className="flex items-center gap-4">
        <span className="flex items-center">
          <AuraFace person={me} size="md" />
          <span className="-ms-3">
            <AuraFace person={them} size="md" />
          </span>
        </span>
        <div className="flex flex-col">
          <span className="text-[13px] text-text-3">{t("youAnd", { name: them.name })}</span>
          {match.isPending ? (
            <Loader2 className="mt-1 size-6 animate-spin text-text-3" />
          ) : m ? (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-title text-[2.75rem] leading-none"
            >
              {m.percent}%
              <span className="ms-2 font-sans text-[14px] font-normal text-text-3">
                {t("tasteMatch")}
              </span>
            </motion.span>
          ) : (
            <span className="text-[15px] text-text-2">{t("noMatch")}</span>
          )}
        </div>
      </div>
      {m?.loves.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold tracking-[0.06em] text-text-3 uppercase">
            {t("bothLove")}
          </p>
          <div className="flex flex-wrap gap-2">
            {m.loves.map((l) => (
              <OpenThing
                key={l.qlooId}
                thing={l.type ? { ...l, type: l.type } : null}
                surface="taste"
                className="inline-flex items-center gap-2 rounded-pill bg-secondary py-1 ps-1 pe-3 text-[13px] font-semibold transition-colors hover:bg-secondary/70"
              >
                {l.image ? (
                  // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
                  <img src={l.image} alt="" className="size-6 rounded-full object-cover" />
                ) : null}
                {l.name}
              </OpenThing>
            ))}
          </div>
        </div>
      ) : null}
      {m?.words.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold tracking-[0.06em] text-text-3 uppercase">
            {t("bothAre")}
          </p>
          <p className="font-title text-[1.4rem] leading-snug">{m.words.slice(0, 6).join(" · ")}</p>
        </div>
      ) : null}
    </section>
  )
}
