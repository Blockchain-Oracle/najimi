import { lookById } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"

/** Identity colours as classes (literal, so Tailwind keeps them). */
export const IDENTITY_BG: Record<string, string> = {
  violet: "bg-violet",
  pink: "bg-pink",
  orange: "bg-orange",
  cobalt: "bg-cobalt",
  teal: "bg-teal",
  butter: "bg-butter",
}

const SIZE = {
  xs: "size-6 text-xs ring-2",
  sm: "size-8 text-sm",
  md: "size-12 text-xl",
  lg: "size-16 text-2xl",
  xl: "size-28 text-5xl",
} as const

/**
 * Someone's face: the look they picked at sign-up on its colour, or their initial on their
 * identity colour (people added for someone else, and profiles from before faces).
 */
export function Face({
  look,
  identity,
  name,
  size = "md",
  className,
}: {
  look: string | null | undefined
  identity: string
  name: string
  size?: keyof typeof SIZE
  className?: string
}) {
  const picked = lookById(look)
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-title text-black ring-4 ring-card",
        IDENTITY_BG[picked?.identity ?? identity] ?? "bg-violet",
        SIZE[size],
        className,
      )}
    >
      {picked ? (
        // biome-ignore lint/performance/noImgElement: a static face from public/
        <img src={`/looks/${picked.id}.png`} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{name.trim().slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  )
}
