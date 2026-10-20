import { cn } from "@najimi/ui/lib/utils"
import Image from "next/image"

const RATIO = { square: "aspect-square", poster: "aspect-[2/3]", place: "aspect-[4/3]" } as const

/**
 * A Qloo entity's artwork in its Ash frame (design lock: colour lives only in artwork). Missing
 * artwork is an intentional poster tile: the name in the display face, never a grey icon box.
 */
export function Artwork({
  src,
  name,
  shape = "square",
  className,
  sizes = "160px",
}: {
  src: string | null | undefined
  name: string
  shape?: keyof typeof RATIO
  className?: string
  sizes?: string
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-card bg-ash", RATIO[shape], className)}>
      {src ? (
        <Image src={src} alt={name} fill sizes={sizes} className="object-cover" unoptimized />
      ) : (
        <span className="font-display-poster absolute inset-0 flex items-end p-3 text-xl leading-[0.9] break-words text-foreground/80">
          {name}
        </span>
      )}
    </div>
  )
}
