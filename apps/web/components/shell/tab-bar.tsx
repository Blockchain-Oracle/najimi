"use client"

import { Orb } from "@najimi/ui/components/orb"
import { cn } from "@najimi/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Suspense } from "react"
import { useAgent } from "@/components/agent/agent-context"
import { isHere, NAV, opensSheet } from "./nav"

/*
 * The phone tab bar: a floating glass pill where the tab you're on opens to show its name, and the
 * others are a tap away: one spring, a layout animation and a pressed scale. Najimi's tab is its
 * orb.
 */

const SPRING = { type: "spring", stiffness: 420, damping: 30, mass: 0.7 } as const

/** The URL is runtime data: the lit-up bar streams in, the plain one is the static shell. */
function CurrentTabs() {
  return <Tabs pathname={usePathname()} />
}

export function TabBar() {
  return (
    <Suspense fallback={<Tabs pathname={null} />}>
      <CurrentTabs />
    </Suspense>
  )
}

function Tabs({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Nav")
  const agent = useAgent()
  return (
    <nav
      aria-label={t("label")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <motion.ul
        layout
        transition={SPRING}
        className="glass pointer-events-auto flex items-center gap-1.5 rounded-pill p-1.5"
      >
        {NAV.map((item) => {
          const here = isHere(pathname, item)
          const Icon = item.icon
          return (
            <motion.li key={item.href} layout transition={SPRING}>
              <Link
                href={item.href}
                onClick={(e) => {
                  // Najimi's orb opens the sheet over this screen (the chat itself is a link away).
                  if (opensSheet(item, pathname)) {
                    e.preventDefault()
                    agent.setOpen(true)
                  }
                }}
                aria-current={here ? "page" : undefined}
                aria-label={t(item.key)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-pill ps-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  here
                    ? "bg-background pe-4 shadow-lift"
                    : "w-11 justify-center ps-0 text-text-2 active:scale-95",
                )}
              >
                {Icon === "orb" ? (
                  <Orb size={28} />
                ) : (
                  <Icon className="size-[22px] shrink-0" strokeWidth={here ? 2.2 : 1.8} />
                )}
                <AnimatePresence initial={false}>
                  {here ? (
                    <motion.span
                      layout
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={SPRING}
                      className="text-sm font-semibold whitespace-nowrap"
                    >
                      {t(item.key)}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </Link>
            </motion.li>
          )
        })}
      </motion.ul>
    </nav>
  )
}
