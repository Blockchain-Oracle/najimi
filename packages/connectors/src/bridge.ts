import { SOCIAL } from "@najimi/config"
import { env } from "@najimi/env/server"
import { PlatformError } from "./errors"

/*
 * The social bridge (apps/social-bridge): Instagram, which only has a maintained Python library
 * (instagrapi). Internal only; each call carries the session it acts with and returns the session's
 * new settings to seal again.
 */

export const bridgeReady = () => Boolean(env.SOCIAL_BRIDGE_URL && env.SOCIAL_BRIDGE_TOKEN)

async function call<T>(path: string, body: unknown): Promise<T> {
  if (!env.SOCIAL_BRIDGE_URL || !env.SOCIAL_BRIDGE_TOKEN)
    throw new PlatformError("Instagram isn't switched on yet", "bridge")
  const res = await fetch(new URL(path, env.SOCIAL_BRIDGE_URL), {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.SOCIAL_BRIDGE_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SOCIAL.bridgeTimeoutMs),
  }).catch(() => null)
  if (!res) throw new PlatformError("Instagram can't be reached right now", "bridge")
  const data = (await res.json().catch(() => null)) as
    | (T & { detail?: { error?: string; code?: PlatformError["code"] } })
    | null
  if (!res.ok || !data) {
    const detail = data?.detail
    throw new PlatformError(
      detail?.error ?? `The bridge answered ${res.status}`,
      detail?.code ?? "bridge",
    )
  }
  return data
}

export type BridgeAccount = {
  id: string
  username: string
  name: string | null
  image: string | null
}
export type BridgePost = {
  id: string
  code: string
  owner: string | null
  ownerName: string | null
  caption: string
  music: { title: string; artist: string } | null
}
type Settings = Record<string, unknown>

export const instagram = {
  connect: (sessionid: string) =>
    call<{ settings: Settings; account: BridgeAccount }>("/instagram/connect", { sessionid }),
  following: (settings: Settings, username?: string) =>
    call<{ settings: Settings; accounts: BridgeAccount[] }>("/instagram/read", {
      settings,
      what: "following",
      username: username ?? null,
      max: SOCIAL.readMax,
    }),
  posts: (settings: Settings, what: "liked" | "saved") =>
    call<{ settings: Settings; posts: BridgePost[] }>("/instagram/read", {
      settings,
      what,
      max: Math.min(SOCIAL.readMax, 100),
    }),
  act: (settings: Settings, action: "follow" | "like" | "save", target: string) =>
    call<{ settings: Settings; ok: boolean; url: string }>("/instagram/act", {
      settings,
      action,
      target,
    }),
  post: (settings: Settings, caption: string, jpegBase64: string) =>
    call<{ settings: Settings; url: string }>("/instagram/post", {
      settings,
      caption,
      image: jpegBase64,
    }),
}
