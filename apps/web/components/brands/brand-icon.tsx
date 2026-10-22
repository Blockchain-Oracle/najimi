import { cn } from "@najimi/ui/lib/utils"
import type { SimpleIcon } from "simple-icons"

/**
 * A real brand mark (Simple Icons, CC0), drawn from its own path. `colored` uses the brand's own
 * colour; otherwise it takes the text colour, so it sits quietly in the neutral frame.
 */
export function BrandIcon({
  icon,
  colored = false,
  className,
}: {
  icon: SimpleIcon
  colored?: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={icon.title}
      className={cn("size-5 shrink-0", className)}
      fill={colored ? `#${icon.hex}` : "currentColor"}
    >
      <path d={icon.path} />
    </svg>
  )
}
