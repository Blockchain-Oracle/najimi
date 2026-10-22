"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@najimi/ui/components/tooltip"
import type { ReactElement } from "react"

/** An icon-only control's name, shown on hover and focus (touch has the aria-label). */
export function Tip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
