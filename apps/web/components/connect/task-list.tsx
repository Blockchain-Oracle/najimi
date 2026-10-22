"use client"

import { cn } from "@najimi/ui/lib/utils"
import { motion, useReducedMotion } from "motion/react"

/*
 * What Najimi is working through, one row per step: a box that draws its own tick, a travelling
 * underline under the one that's running, finished rows going quiet. From 21st.dev
 * educalvolpz/ai-task-list, on our tokens; counts are derived from the rows so they never disagree.
 */

export type TaskStatus = "pending" | "running" | "done" | "failed"
export type Task = { id: string; label: string; note?: string | null; status: TaskStatus }

const CHECK = "M 3.5 7.5 L 6 10 L 10.5 4.5"
const CROSS = "M 5 5 L 9 9 M 9 5 L 5 9"

function Box({ status, still }: { status: TaskStatus; still: boolean }) {
  const tone =
    status === "done"
      ? "var(--color-success)"
      : status === "failed"
        ? "var(--color-danger)"
        : "currentColor"
  return (
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
      <svg aria-hidden className="size-4" viewBox="0 0 14 14">
        <motion.rect
          x={1}
          y={1}
          width={12}
          height={12}
          rx={3.5}
          strokeWidth={1.4}
          fill={tone}
          animate={{ fillOpacity: status === "done" ? 0.14 : 0, stroke: tone }}
          transition={still ? { duration: 0 } : { duration: 0.2 }}
        />
        {status === "done" || status === "failed" ? (
          <path
            className="najimi-task-draw"
            d={status === "done" ? CHECK : CROSS}
            fill="none"
            pathLength={1}
            stroke={tone}
            strokeDasharray="1 1"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        ) : null}
      </svg>
    </span>
  )
}

export function TaskList({
  label,
  tasks,
  className,
}: {
  label?: string
  tasks: Task[]
  className?: string
}) {
  const still = Boolean(useReducedMotion())
  const done = tasks.filter((t) => t.status === "done").length
  return (
    <div className={cn("flex flex-col gap-1 rounded-tile bg-white/5 p-3", className)}>
      {label ? (
        <div className="mb-1 flex items-baseline justify-between">
          <p className="text-[13px] font-semibold">{label}</p>
          <p className="text-[12px] text-text-3 tabular-nums">
            {done}/{tasks.length}
          </p>
        </div>
      ) : null}
      <style>{`
        .najimi-task-draw { stroke-dashoffset: 0; }
        @media (prefers-reduced-motion: no-preference) {
          .najimi-task-draw { animation: najimi-task-draw 220ms cubic-bezier(0.23, 1, 0.32, 1) both; }
        }
        @keyframes najimi-task-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
      `}</style>
      <ul className="flex flex-col">
        {tasks.map((task) => (
          <motion.li
            key={task.id}
            className="list-none"
            animate={{
              opacity: task.status === "done" ? 0.7 : task.status === "pending" ? 0.55 : 1,
              y: task.status === "done" && !still ? 1 : 0,
            }}
            transition={still ? { duration: 0 } : { type: "spring", bounce: 0.1, duration: 0.25 }}
          >
            <span className="relative flex items-start gap-2.5 py-1.5">
              <Box status={task.status} still={still} />
              <span
                className={cn(
                  "min-w-0 flex-1 text-[14px] leading-snug",
                  task.status === "failed" && "text-danger",
                )}
              >
                {task.label}
              </span>
              {task.note ? (
                <span className="shrink-0 text-[12px] text-text-3 tabular-nums">{task.note}</span>
              ) : null}
              {task.status === "running" && !still ? (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-px text-signal"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, transparent 0%, currentColor 50%, transparent 100%)",
                    backgroundSize: "50% 100%",
                  }}
                  animate={{ backgroundPositionX: ["0%", "200%"] }}
                  transition={{
                    duration: 1.4,
                    ease: [0.645, 0.045, 0.355, 1],
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                />
              ) : null}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
