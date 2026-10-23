"use client"

import { cn } from "@najimi/ui/lib/utils"
import { motion } from "motion/react"
import type { CSSProperties } from "react"

/*
 * Words with light running across them, for "working on it" moments, on `motion`, in two tones: on
 * paper and on the wall.
 */
export function TextShimmer({
  children,
  className,
  tone = "wall",
  duration = 2,
}: {
  children: string
  className?: string
  tone?: "wall" | "paper"
  duration?: number
}) {
  const base = tone === "paper" ? "#8a7e84" : "#9b8f97"
  const glow = tone === "paper" ? "#111114" : "#FFF6EE"
  return (
    <motion.span
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent [background-repeat:no-repeat,padding-box]",
        className,
      )}
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{ repeat: Number.POSITIVE_INFINITY, duration, ease: "linear" }}
      style={
        {
          "--spread": `${children.length * 2}px`,
          backgroundImage: `linear-gradient(90deg, #0000 calc(50% - var(--spread)), ${glow}, #0000 calc(50% + var(--spread))), linear-gradient(${base}, ${base})`,
        } as CSSProperties
      }
    >
      {children}
    </motion.span>
  )
}
