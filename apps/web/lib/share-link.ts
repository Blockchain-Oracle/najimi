"use client"

import { toast } from "@najimi/ui/components/sonner"
import { api } from "@/lib/fetcher"

/** Makes (or reuses) a public link to a creation, a chat or a taste, and copies it. */
export async function shareLink(
  kind: "creation" | "chat" | "person",
  refId: string,
  copied: string,
): Promise<string> {
  const { url } = await api<{ url: string }>("/api/shares", { json: { kind, refId } })
  await navigator.clipboard.writeText(url).catch(() => undefined)
  toast(copied, { description: url })
  return url
}
