"use client"

import { Toaster } from "@najimi/ui/components/sonner"
import { QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "motion/react"
import { PlayerProvider } from "@/components/player/player"
import { getQueryClient } from "@/lib/query-client"

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {/* Respect the system "reduce motion" setting everywhere: movement goes, fades stay. */}
      <MotionConfig reducedMotion="user">
        {/* One player for every screen: what the feed starts keeps playing as you move around. */}
        <PlayerProvider>{children}</PlayerProvider>
      </MotionConfig>
      <Toaster theme="system" position="bottom-center" />
    </QueryClientProvider>
  )
}
