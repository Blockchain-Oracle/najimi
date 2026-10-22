"use client"

import { Toaster } from "@najimi/ui/components/sonner"
import { QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "motion/react"
import { useEffect } from "react"
import { AgentProvider } from "@/components/agent/agent-context"
import { PlayerProvider } from "@/components/player/player"
import { startPush } from "@/lib/push-client"
import { getQueryClient } from "@/lib/query-client"

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  // The service worker (push, the home-screen app) from the first page on.
  useEffect(() => startPush(), [])
  return (
    <QueryClientProvider client={queryClient}>
      {/* Respect the system "reduce motion" setting everywhere: movement goes, fades stay. */}
      <MotionConfig reducedMotion="user">
        {/* One player for every screen: what the feed starts keeps playing as you move around. */}
        <PlayerProvider>
          <AgentProvider>{children}</AgentProvider>
        </PlayerProvider>
      </MotionConfig>
      <Toaster theme="system" position="bottom-center" />
    </QueryClientProvider>
  )
}
