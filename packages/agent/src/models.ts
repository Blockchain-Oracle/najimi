import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { AGENT } from "@najimi/config"
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
