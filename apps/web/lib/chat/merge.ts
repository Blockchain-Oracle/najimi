import { askUserOutput, type NajimiUIMessage } from "@najimi/agent"
import { getToolName, isToolUIPart } from "ai"

type Part = NajimiUIMessage["parts"][number]
const MEDIA_PATH = /^\/api\/media\/upload\/([0-9a-f-]{36})\?v=(original|display)$/

/** The upload ids a user message's photos point at (each must be the sender's own). */
export function uploadIdsOf(message: NajimiUIMessage): string[] {
  return message.parts.flatMap((p) => {
    if (p.type !== "file") return []
    const m = MEDIA_PATH.exec(p.url)
    return m?.[1] ? [m[1]] : []
  })
}

/** A person's message keeps only words and photos of ours: nothing else a client could invent. */
function cleanUserParts(parts: Part[]): Part[] | null {
  const out: Part[] = []
  for (const p of parts) {
    if (p.type === "text") out.push({ type: "text", text: p.text.slice(0, 8000) })
    else if (p.type === "file") {
      if (!MEDIA_PATH.test(p.url) || !p.mediaType.startsWith("image/")) return null
      out.push({ type: "file", url: p.url, mediaType: p.mediaType, filename: p.filename })
    }
  }
  return out.some((p) => p.type === "text" || p.type === "file") ? out : null
}

/**
 * Lays the one message the client sent over the stored conversation (the server owns history):
 * - a new user message is appended (one already stored is a resend: what came after it goes);
 * - a continuation of the last assistant message only carries the person's answers: a wizard's
 *   output (checked against its schema) or an approval decision (signed by the SDK). Nothing else
 *   on it is taken from the client.
 * Returns null when the message can't be accepted.
 */
export function mergeIncoming(
  stored: NajimiUIMessage[],
  incoming: NajimiUIMessage,
): NajimiUIMessage[] | null {
  if (incoming.role === "user") {
    const parts = cleanUserParts(incoming.parts)
    if (!parts) return null
    const clean: NajimiUIMessage = {
      id: incoming.id,
      role: "user",
      parts,
      metadata: { createdAt: Date.now() },
    }
    const at = stored.findIndex((m) => m.id === incoming.id)
    return at === -1 ? [...stored, clean] : [...stored.slice(0, at), clean]
  }
  if (incoming.role !== "assistant") return null
  const last = stored.at(-1)
  if (last?.role !== "assistant" || last.id !== incoming.id) return null

  const parts = last.parts.map((part): Part => {
    if (!isToolUIPart(part)) return part
    const theirs = incoming.parts.find((p) => isToolUIPart(p) && p.toolCallId === part.toolCallId)
    if (!theirs || !isToolUIPart(theirs)) return part
    if (part.state === "input-available" && getToolName(part) === "askUser") {
      if (theirs.state === "output-available") {
        const output = askUserOutput.safeParse(theirs.output)
        return output.success
          ? ({ ...part, state: "output-available", output: output.data } as Part)
          : part
      }
      if (theirs.state === "output-error")
        return { ...part, state: "output-error", errorText: "Skipped" } as Part
      return part
    }
    if (part.state === "approval-requested" && theirs.state === "approval-responded") {
      return {
        ...part,
        state: "approval-responded",
        approval: { ...part.approval, approved: theirs.approval.approved === true },
      } as Part
    }
    return part
  })
  return [...stored.slice(0, -1), { ...last, parts }]
}

/** Regenerate: everything after the user message that led to `assistantId` goes. */
export function truncateForRegenerate(
  stored: NajimiUIMessage[],
  assistantId: string,
): NajimiUIMessage[] | null {
  const at = stored.findIndex((m) => m.id === assistantId)
  if (at <= 0 || stored[at]?.role !== "assistant") return null
  return stored.slice(0, at)
}
