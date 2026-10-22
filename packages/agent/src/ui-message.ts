import type { InferUITools, UIMessage } from "ai"
import type { ToolDefs } from "./tools"

/** What rides on a message besides its parts. */
export type ChatMeta = {
  createdAt?: number
  /** When the answer finished: with createdAt, how long the run took. */
  finishedAt?: number
  /** The model that answered (`openai:gpt-6-astra`). */
  model?: string
  /** "Compare without taste": the same ask answered with no taste and no tools. */
  compare?: { generic: string; at: number }
}

export type NajimiTools = InferUITools<ToolDefs>
export type NajimiUIMessage = UIMessage<ChatMeta, Record<string, never>, NajimiTools>
