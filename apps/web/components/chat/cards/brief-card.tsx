"use client"

import type { NajimiTools } from "@najimi/agent"
import { useTranslations } from "next-intl"
import { Artwork } from "@/components/artwork"
import { WithPerson } from "../chat-context"
import { CardShell } from "./insights-card"

type Output = NajimiTools["tasteBrief"]["output"]

/** The taste brief (rule 2): the words a plan or creation will be built from, and whose loves they are. */
export function BriefCard({ output }: { output: Output }) {
  const t = useTranslations("Cards")
  const tw = useTranslations("Taste.words")
  return (
    <CardShell title={output.ask} callId={null}>
      <p className="text-sm text-paper-muted">
        <WithPerson
          text={(name) => t("briefFor", { name })}
          name={output.personName}
          id={output.personId}
        />
      </p>
      <div className="flex -space-x-3 rtl:space-x-reverse">
        {output.loves.slice(0, 6).map((l) => (
          <Artwork
            key={l.name}
            src={l.image}
            name={l.name}
            shape="square"
            className="size-12 rounded-full ring-2 ring-paper"
          />
        ))}
      </div>
      <dl className="flex flex-col gap-2">
        {Object.entries(output.words)
          .filter(([, w]) => w.length)
          .map(([family, words]) => (
            <div
              key={family}
              className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <dt className="w-16 shrink-0 text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
                {tw.has(family as "decor") ? tw(family as "decor") : family}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {words.map((w) => (
                  <span
                    key={w}
                    className="rounded-pill bg-paper-foreground/6 px-2.5 py-1 text-[13px]"
                  >
                    {w}
                  </span>
                ))}
              </dd>
            </div>
          ))}
      </dl>
    </CardShell>
  )
}
