"use client"

import { Toaster } from "@najimi/ui/components/sonner"
import { QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "motion/react"
import { getQueryClient } from "@/lib/query-client"

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {/* Respect the system "reduce motion" setting everywhere: movement goes, fades stay. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <Toaster theme="dark" position="bottom-center" />
    </QueryClientProvider>
  )
}
