import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@najimi/ui/lib/utils"
import type * as React from "react"

/** A flat field on a hairline (design lock: nav and search radius 20px, no shadow, 40px tall). */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-nav border border-input bg-background px-4 text-sm text-foreground transition-colors duration-(--motion-quick) outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-3 focus-visible:border-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
