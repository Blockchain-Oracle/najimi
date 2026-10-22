"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"

/**
 * Opens a fresh chat. Each time with its own query: a chat started at /c rewrites its address to
 * /c/<id> without the router knowing, so a plain link to /c looks like the same page and does
 * nothing.
 */
export function useNewChat() {
  const router = useRouter()
  return useCallback(() => router.push(`/c?new=${Date.now().toString(36)}`), [router])
}
