import type { TasteWords } from "@najimi/db/schema"
import { cn } from "@najimi/ui/lib/utils"
import { Artwork } from "@/components/artwork"

export type CardLove = { qlooId: string; name: string; imageUrl: string | null; type: string }

const IDENTITY_BG: Record<string, string> = {
  violet: "bg-violet",
  pink: "bg-pink",
  cobalt: "bg-cobalt",
  orange: "bg-orange",
  teal: "bg-teal",
  butter: "bg-butter",
}

/** The loves, fanned like a hand of cards on the person's identity colour (the Showcase card). */
export function LovesFan({ loves, identity }: { loves: CardLove[]; identity: string }) {
  const shown = loves.slice(0, 7)
  const mid = (shown.length - 1) / 2
  return (
    <div
      className={cn(
        "relative flex h-44 items-end justify-center overflow-hidden rounded-t-card pb-4",
        IDENTITY_BG[identity],
      )}
    >
      {shown.map((love, i) => {
        const offset = i - mid
        return (
          <div
            key={love.qlooId}
            className="-mx-4 w-24 shrink-0 origin-bottom animate-card-land first:ms-0 last:me-0 sm:w-28"
            style={
              {
                "--tilt": `${offset * 7}deg`,
                transform: `rotate(${offset * 7}deg) translateY(${Math.abs(offset) * 6}px)`,
                zIndex: 10 - Math.abs(Math.round(offset)),
                animationDelay: `${i * 70}ms`,
              } as React.CSSProperties
            }
          >
            <Artwork
              src={love.imageUrl}
              name={love.name}
              shape="poster"
              className="rounded-tile shadow-sticker ring-2 ring-paper"
            />
          </div>
        )
      })}
    </div>
  )
}

/** Word chips by family: the vocabulary images and plans are made from (rule 2). */
export function TasteWordsView({
  words,
  labels,
  families = ["aesthetic", "decor", "ambience", "style", "cuisine"],
}: {
  words: TasteWords
  labels: Record<string, string>
  families?: (keyof TasteWords)[]
}) {
  return (
    <dl className="flex flex-col gap-3">
      {families
        .filter((f) => words[f]?.length)
        .map((family) => (
          <div
            key={family}
            className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3"
          >
            <dt className="w-16 shrink-0 text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
              {labels[family]}
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {words[family].slice(0, 6).map((w, i) => (
                <span
                  key={w}
                  className="animate-settle-in rounded-pill bg-paper-foreground/6 px-2.5 py-1 text-[13px] font-medium"
                  style={{ "--enter-delay": `${i * 40}ms` } as React.CSSProperties}
                >
                  {w}
                </span>
              ))}
            </dd>
          </div>
        ))}
    </dl>
  )
}
