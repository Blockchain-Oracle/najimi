"use client"

import type { Screen } from "@najimi/agent"
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"

/*
 * Najimi on every screen (W6): the sheet's open state, and what you're looking at right now (a
 * screen reports it: the feed its card), so asking "more like this" needs no explaining.
 */

type AgentApi = {
  open: boolean
  setOpen: (open: boolean) => void
  screen: Screen | null
  setScreen: (screen: Screen | null) => void
  /** Opens the sheet and sends this, as if typed ("Plan a night in Victoria Island"). */
  ask: (text: string) => void
  /** What `ask` left for the sheet to send (it clears it once sent). */
  pending: string | null
  clearPending: () => void
}

const AgentContext = createContext<AgentApi | null>(null)

export function AgentProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<Screen | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const api = useMemo(
    () => ({
      open,
      setOpen,
      screen,
      setScreen,
      pending,
      ask: (text: string) => {
        setPending(text)
        setOpen(true)
      },
      clearPending: () => setPending(null),
    }),
    [open, screen, pending],
  )
  return <AgentContext.Provider value={api}>{children}</AgentContext.Provider>
}

export function useAgent() {
  const api = useContext(AgentContext)
  if (!api) throw new Error("useAgent needs AgentProvider")
  return api
}

/** A screen says what's on it while it's showing (cleared when it goes). */
export function useReportScreen(screen: Screen | null) {
  const { setScreen } = useAgent()
  const key = screen ? `${screen.where}|${screen.label}|${screen.qlooId ?? ""}` : ""
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key is the screen's identity
  useEffect(() => {
    setScreen(screen)
    return () => setScreen(null)
  }, [key, setScreen])
}
