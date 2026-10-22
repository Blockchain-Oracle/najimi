import type { TasteWords } from "@najimi/db/schema"
import { cn } from "@najimi/ui/lib/utils"
import { Artwork } from "@/components/artwork"

export type CardLove = { qlooId: string; name: string; imageUrl: string | null; type: string }

/** The loves it came from, in a row: their artwork as it is, no tilt, no frame. */
export function LovesRow({ loves, size = "md" }: { loves: CardLove[]; size?: "sm" | "md" }) {
  if (!loves.length) return null
  return (
    <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
      {loves.slice(0, 7).map((love, i) => (
        <li
          key={love.qlooId}
          className={cn("shrink-0 animate-settle-in", size === "md" ? "w-[72px]" : "w-12")}
          style={{ "--enter-delay": `${i * 40}ms` } as React.CSSProperties}
          title={love.name}
        >
          <Artwork src={love.imageUrl} name={love.name} shape="poster" />
        </li>
      ))}
    </ul>
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
            <dt className="w-16 shrink-0 text-[11px] font-medium tracking-[0.08em] text-text-3 uppercase">
              {labels[family]}
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {words[family].slice(0, 6).map((w, i) => (
                <span
                  key={w}
                  className="animate-settle-in rounded-tag bg-raised px-2.5 py-1 text-[13px] text-text-2 shadow-sticker"
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
