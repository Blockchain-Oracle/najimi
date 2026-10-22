import type { NajimiUIMessage } from "@najimi/agent"

const MEDIA_PATH = /^\/api\/media\/upload\/([0-9a-f-]{36})\?v=(original|display)$/

/** The upload ids a user message's photos point at (each must be the sender's own). */
export function uploadIdsOf(message: NajimiUIMessage): string[] {
  return message.parts.flatMap((p) => {
    if (p.type !== "file") return []
    const m = MEDIA_PATH.exec(p.url)
    return m?.[1] ? [m[1]] : []
  })
}
