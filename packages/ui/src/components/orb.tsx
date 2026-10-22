"use client"

import type { CSSProperties } from "react"
import { cn } from "../lib/utils"

/*
 * The orb: Najimi's presence (the tab bar, the agent sheet, the run) and each person's taste aura,
 * lit in their three taste colours. Adapted from 21st.dev's Siri Orb by educalvolpz (SmoothUI,
 * MIT): six conic gradients turning on one animated angle, blurred, with a dotted overlay. Pure
 * CSS, no canvas. `working` spins it faster; reduced motion stops it.
 */

export type OrbColors = { c1: string; c2: string; c3: string }

type Props = {
  /** Diameter in px. */
  size?: number
  /** A person's or the agent's taste colours; defaults to the agent's aura tokens. */
  colors?: Partial<OrbColors>
  /** The agent is working: a faster turn. */
  working?: boolean
  className?: string
  label?: string
}

const SMALL = 50
const TINY = 30
const MEDIUM = 100

export function Orb({ size = 192, colors, working = false, className, label }: Props) {
  const small = size < SMALL
  const blur = small ? Math.max(size * 0.008, 1) : Math.max(size * 0.015, 4)
  const contrast = small ? Math.max(size * 0.004, 1.2) : Math.max(size * 0.008, 1.5)
  const dot = small ? Math.max(size * 0.004, 0.05) : Math.max(size * 0.008, 0.1)
  const spread = small ? Math.max(size * 0.004, 0.5) : Math.max(size * 0.008, 2)
  const mask = size < TINY ? "0%" : size < SMALL ? "5%" : size < MEDIUM ? "15%" : "25%"
  const finalContrast = size < TINY ? 1.1 : small ? Math.max(contrast * 1.2, 1.3) : contrast
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      data-mask={mask === "0%" ? "none" : undefined}
      className={cn("najimi-orb", className)}
      style={
        {
          width: size,
          height: size,
          "--orb-bg": "var(--color-background)",
          "--orb-c1": colors?.c1 ?? "var(--color-aura-1)",
          "--orb-c2": colors?.c2 ?? "var(--color-aura-2)",
          "--orb-c3": colors?.c3 ?? "var(--color-aura-3)",
          "--orb-duration": working ? "6s" : "20s",
          "--orb-blur": `${blur}px`,
          "--orb-contrast": finalContrast,
          "--orb-dot": `${dot}px`,
          "--orb-spread": `${spread}px`,
          "--orb-mask": mask,
        } as CSSProperties
      }
    />
  )
}
