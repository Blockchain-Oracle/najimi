import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import { CLAUDE, type ClaudeRole } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { env } from "@najimi/env/server"
import type { z } from "zod"

/*
 * Claude through the official SDK (claude-api skill), one model tuned by effort per role
 * (plan §4.5). Refusals fall back on the server ("default"), and every call is logged with its
 * tokens so cost and cache hits are visible.
 */

export class ClaudeNotConfigured extends Error {
  constructor() {
    super("Claude isn't connected yet (ANTHROPIC_API_KEY is not set)")
    this.name = "ClaudeNotConfigured"
  }
}

export class ClaudeRefused extends Error {
  constructor(readonly category: string | null) {
    super("Claude declined this request")
    this.name = "ClaudeRefused"
  }
}

export function claudeConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY)
}

const globalForClaude = globalThis as unknown as { najimiClaude?: Anthropic }

export function claude(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new ClaudeNotConfigured()
  globalForClaude.najimiClaude ??= new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    // Pinned: the desktop app's shell exports ANTHROPIC_BASE_URL for its own use.
    baseURL: env.NAJIMI_CLAUDE_BASE_URL ?? CLAUDE.baseUrl,
    timeout: CLAUDE.timeoutMs,
  })
  return globalForClaude.najimiClaude
}

export type ClaudeContext = { businessId?: string | null; runId?: string | null }

type Usage = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

async function logCall(entry: {
  ctx: ClaudeContext
  purpose: string
  effort: string
  usage?: Usage | null
  ms: number
  stopReason?: string | null
  refusalCategory?: string | null
  error?: string
}) {
  await db.insert(schema.llmCalls).values({
    businessId: entry.ctx.businessId ?? null,
    runId: entry.ctx.runId ?? null,
    purpose: entry.purpose,
    model: CLAUDE.model,
    effort: entry.effort,
    inputTokens: entry.usage?.input_tokens ?? null,
    outputTokens: entry.usage?.output_tokens ?? null,
    cacheReadTokens: entry.usage?.cache_read_input_tokens ?? null,
    cacheWriteTokens: entry.usage?.cache_creation_input_tokens ?? null,
    ms: entry.ms,
    stopReason: entry.stopReason ?? null,
    refusalCategory: entry.refusalCategory ?? null,
    error: entry.error ?? null,
  })
}

/**
 * One structured answer: Claude reads `input` under `system` and returns data matching `schema`
 * (structured outputs, so the shape is guaranteed). `cachedPrefix` is stable text placed before
 * the input with a cache breakpoint (the business's fact sheet, its Your People summary).
 */
export async function structured<S extends z.ZodType>(options: {
  role: ClaudeRole
  purpose: string
  schema: S
  system: string
  cachedPrefix?: string
  input: string
  ctx?: ClaudeContext
}): Promise<z.infer<S>> {
  const effort = CLAUDE.effort[options.role]
  const started = Date.now()
  const ctx = options.ctx ?? {}
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (options.cachedPrefix)
    content.push({ type: "text", text: options.cachedPrefix, cache_control: { type: "ephemeral" } })
  content.push({ type: "text", text: options.input })
  try {
    const response = await claude().beta.messages.parse({
      model: CLAUDE.model,
      max_tokens: CLAUDE.maxTokens.extract,
      betas: [CLAUDE.fallbackBeta],
      fallbacks: "default",
      system: options.system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: betaZodOutputFormat(options.schema) },
    })
    const refusal = response.stop_reason === "refusal"
    await logCall({
      ctx,
      purpose: options.purpose,
      effort,
      usage: response.usage,
      ms: Date.now() - started,
      stopReason: response.stop_reason,
      refusalCategory: refusal ? (response.stop_details?.category ?? null) : null,
    })
    if (refusal) throw new ClaudeRefused(response.stop_details?.category ?? null)
    if (response.parsed_output == null)
      throw new Error("Claude's answer didn't match the expected shape")
    return response.parsed_output as z.infer<S>
  } catch (error) {
    if (!(error instanceof ClaudeRefused))
      await logCall({
        ctx,
        purpose: options.purpose,
        effort,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined)
    throw error
  }
}
