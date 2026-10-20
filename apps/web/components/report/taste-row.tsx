import { Artwork } from "@/components/artwork"
import { EvidenceChip } from "./evidence-chip"
import type { ReportItem } from "./types"

/** Artwork shape per domain (design lock: 1:1 music/books/podcasts, 2:3 film/TV, 4:3 places). */
const SHAPE: Record<string, "square" | "poster" | "place"> = {
  movie: "poster",
  tv_show: "poster",
  place: "place",
  destination: "place",
}

/**
 * One domain of what your people also love, as a row of artwork (DICE's "Trending in…"
 * carousel). Scrolls sideways; names sit flush under the art.
 */
export function TasteRow({
  domainKey,
  label,
  items,
  callId,
  error,
  publicView,
}: {
  domainKey: string
  label: string
  items: ReportItem[]
  callId: string | null
  error?: string
  publicView?: boolean
}) {
  const shape = SHAPE[domainKey] ?? "square"
  return (
    <section aria-labelledby={`row-${domainKey}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`row-${domainKey}`} className="text-xs font-bold uppercase">
          {label}
        </h3>
        <EvidenceChip callId={callId} label={`${label} your people love`} publicView={publicView} />
      </div>
      {error ? (
        <p className="text-sm text-text-3">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-3">Qloo has nothing for this yet.</p>
      ) : (
        <ul className="-mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:thin]">
          {items.map((item) => (
            <li
              key={item.entityId}
              className="flex w-32 shrink-0 snap-start flex-col gap-2 sm:w-36"
            >
              <Artwork src={item.image} name={item.name} shape={shape} sizes="144px" />
              <span className="line-clamp-2 text-sm leading-snug font-bold">{item.name}</span>
              {item.tags[0] ? (
                <span className="truncate text-xs text-text-3">{item.tags[0]}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
