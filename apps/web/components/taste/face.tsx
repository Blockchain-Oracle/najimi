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
  xs: "size-6 text-xs",
  sm: "size-8 text-sm",
  md: "size-12 text-xl",
  lg: "size-16 text-2xl",
  xl: "size-24 text-4xl",
} as const

/**
 * Someone's face: the look they picked at sign-up on its colour (the one place an identity colour
 * appears), or their initial in ink on a raised disc (people added for someone else, and profiles
 * from before faces).
 */
export function Face({
  look,
  name,
  size = "md",
  className,
}: {
  look: string | null | undefined
  name: string
  size?: keyof typeof SIZE
  className?: string
}) {
  const picked = lookById(look)
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-title",
        picked
          ? (IDENTITY_BG[picked.identity] ?? "bg-violet")
          : "bg-raised text-foreground shadow-sticker",
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
