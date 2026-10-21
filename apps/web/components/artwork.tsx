import { cn } from "@najimi/ui/lib/utils"

const RATIO = {
  square: "aspect-square",
  poster: "aspect-[2/3]",
  place: "aspect-[4/3]",
} as const

/** Artwork shape per Qloo type: posters for film and TV, landscape for places, square otherwise. */
export function shapeOf(type: string | null | undefined): keyof typeof RATIO {
  if (type === "urn:entity:movie" || type === "urn:entity:tv_show" || type === "urn:entity:book")
    return "poster"
  if (type === "urn:entity:place" || type === "urn:entity:destination") return "place"
  return "square"
}

/**
 * A Qloo entity's artwork. Missing artwork (games, people, destinations) is an intentional poster
 * tile: the name set large on kraft, never a grey icon box.
 */
export function Artwork({
  src,
  name,
  shape = "square",
  className,
}: {
  src: string | null | undefined
  name: string
  shape?: keyof typeof RATIO
  className?: string
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-tile bg-ash", RATIO[shape], className)}>
      {src ? (
        // biome-ignore lint/performance/noImgElement: Qloo artwork comes from many hosts; no resizing proxy
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="font-title absolute inset-0 flex items-end bg-kraft p-2.5 text-base leading-[0.95] break-words text-kraft-foreground">
          {name}
        </span>
      )}
    </div>
  )
}
