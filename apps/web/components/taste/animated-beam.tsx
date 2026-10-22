"use client"

import { cn } from "@najimi/ui/lib/utils"
import { motion } from "motion/react"
import { type RefObject, useEffect, useId, useState } from "react"

/*
 * A light travelling along a curved path between two elements. Magic UI's Animated Beam
 * (21st.dev, @dillionverma/animated-beam, MIT), on `motion` instead of framer-motion, and
 * standing still for anyone who asked for less motion.
 */

export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 4,
  delay = 0,
  pathColor = "currentColor",
  pathWidth = 2,
  pathOpacity = 0.15,
  gradientStartColor = "#C9FF3D",
  gradientStopColor = "#FFF6EE",
}: {
  className?: string
  containerRef: RefObject<HTMLElement | null>
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  curvature?: number
  reverse?: boolean
  duration?: number
  delay?: number
  pathColor?: string
  pathWidth?: number
  pathOpacity?: number
  gradientStartColor?: string
  gradientStopColor?: string
}) {
  const id = useId()
  const [d, setD] = useState("")
  const [size, setSize] = useState({ width: 0, height: 0 })
  const sweep = reverse
    ? { x1: ["90%", "-10%"], x2: ["100%", "0%"] }
    : { x1: ["10%", "110%"], x2: ["0%", "100%"] }

  useEffect(() => {
    const update = () => {
      const box = containerRef.current?.getBoundingClientRect()
      const a = fromRef.current?.getBoundingClientRect()
      const b = toRef.current?.getBoundingClientRect()
      if (!box || !a || !b) return
      setSize({ width: box.width, height: box.height })
      const sx = a.left - box.left + a.width / 2
      const sy = a.top - box.top + a.height / 2
      const ex = b.left - box.left + b.width / 2
      const ey = b.top - box.top + b.height / 2
      setD(`M ${sx},${sy} Q ${(sx + ex) / 2},${sy - curvature} ${ex},${ey}`)
    }
    const observer = new ResizeObserver(update)
    if (containerRef.current) observer.observe(containerRef.current)
    update()
    return () => observer.disconnect()
  }, [containerRef, fromRef, toRef, curvature])

  return (
    <svg
      fill="none"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      className={cn("pointer-events-none absolute top-0 left-0 transform-gpu", className)}
      aria-hidden
    >
      <path
        d={d}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      <path d={d} strokeWidth={pathWidth} stroke={`url(#${id})`} strokeLinecap="round" />
      <defs>
        <motion.linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
          animate={{ x1: sweep.x1, x2: sweep.x2, y1: ["0%", "0%"], y2: ["0%", "0%"] }}
          transition={{
            delay,
            duration,
            ease: [0.16, 1, 0.3, 1],
            repeat: Number.POSITIVE_INFINITY,
          }}
          className="motion-reduce:hidden"
        >
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop stopColor={gradientStartColor} />
          <stop offset="32.5%" stopColor={gradientStopColor} />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  )
}
