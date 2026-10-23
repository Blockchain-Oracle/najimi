import { cn } from "@najimi/ui/lib/utils"
import { encode } from "uqr"

/**
 * A QR code as one SVG path (uqr): dark modules on a light square, the way phones read them
 * best. Renders on the server or the client; size comes from the className.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  const { data, size } = encode(value, { ecc: "M", border: 1 })
  let d = ""
  data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`
    })
  })
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={cn("block", className)}
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={d} fill="#0b0b0d" />
    </svg>
  )
}
