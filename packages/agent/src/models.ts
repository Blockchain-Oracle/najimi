import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { AGENT, MODELS } from "@najimi/config"
import { env } from "@najimi/env/server"
import { createProviderRegistry, type LanguageModel } from "ai"

/*
 * Every model call (the chat, titles, Compare without taste) goes through one registry, so the
 * provider is a setting: `AGENT_MODEL=openai:gpt-6-astra` or `anthropic:claude-opus-5-5`. Base URLs
 * are pinned: the providers would otherwise read ANTHROPIC_BASE_URL / OPENAI_BASE_URL from the shell.
 */

export class AgentNotConfigured extends Error {
  constructor(provider: string) {
    super(`The ${provider} key isn't set on this server`)
    this.name = "AgentNotConfigured"
  }
}

let registry: ReturnType<typeof build> | undefined
function build() {
  return createProviderRegistry({
    anthropic: createAnthropic({
      apiKey: env.ANTHROPIC_API_KEY ?? "",
      baseURL: AGENT.baseUrls.anthropic,
    }),
    openai: createOpenAI({ apiKey: env.OPENAI_API_KEY ?? "", baseURL: AGENT.baseUrls.openai }),
  })
}

export type ModelId = `anthropic:${string}` | `openai:${string}`

let openaiTools: ReturnType<typeof createOpenAI> | undefined
/**
 * OpenAI's hosted web search, for what Qloo doesn't carry (news, opening hours, a venue's phone,
 * what's on this week), near the asker's city when it's known.
 */
export function webSearchTool(city?: string | null) {
  openaiTools ??= createOpenAI({ apiKey: env.OPENAI_API_KEY ?? "", baseURL: AGENT.baseUrls.openai })
  return openaiTools.tools.webSearch({
    searchContextSize: "low",
    ...(city ? { userLocation: { type: "approximate" as const, city } } : {}),
  })
}

/** The configured model id (`provider:model`). */
export function agentModelId(): ModelId {
  return (env.AGENT_MODEL ?? AGENT.defaultModel) as ModelId
}

export function providerOf(id: ModelId): "anthropic" | "openai" {
  return id.startsWith("anthropic:") ? "anthropic" : "openai"
}

/** Whether the configured provider has a key: features that need the agent say so otherwise. */
export function agentReady(id: ModelId = agentModelId()): boolean {
  return providerOf(id) === "anthropic"
    ? Boolean(env.ANTHROPIC_API_KEY)
    : Boolean(env.OPENAI_API_KEY)
}

export function agentModel(id: ModelId = agentModelId()): LanguageModel {
  if (!agentReady(id)) throw new AgentNotConfigured(providerOf(id))
  registry ??= build()
  return registry.languageModel(id)
}

/** The model the agent thinks with in rooms (plans, comparisons, games, bookings). */
export const brainModelId = (): ModelId => MODELS.brain as ModelId

/** The model for light work (titles, short phrasing); `AGENT_MODEL` can point it elsewhere. */
export const lightModelId = (): ModelId => agentModelId()

/** What a call cost in US dollars, from its tokens and the model's price (null when unpriced). */
export function costOf(
  id: string,
  usage: { input?: number | null; output?: number | null; cached?: number | null },
): number | null {
  const price = MODELS.prices[id]
  if (!price) return null
  const cached = usage.cached ?? 0
  const fresh = Math.max(0, (usage.input ?? 0) - cached)
  return (fresh * price.input + cached * price.cached + (usage.output ?? 0) * price.output) / 1e6
}
