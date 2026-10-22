import { createOpenAI } from "@ai-sdk/openai"
import { createFalClient } from "@fal-ai/client"
import { AGENT, MEDIA } from "@najimi/config"
import { env } from "@najimi/env/server"
import { generateImage } from "ai"

/*
 * Making media. Images run on fal.ai (FLUX 2) when there's a fal key, else OpenAI: an edit keeps
 * the person's real room or object and changes its look; a new image makes a scene from words.
 * Video runs on fal.ai, submitted to its queue and checked by the worker's poller, so a render
 * outlives a restart; it stays off until MEDIA.video.enabled.
 */

/** The provider wouldn't make it (a safety refusal): shown kindly, and the allowance comes back. */
export class MediaRefused extends Error {
  constructor(message = "The image provider declined this one") {
    super(message)
    this.name = "MediaRefused"
  }
}

export const imagesReady = () => Boolean(env.FAL_KEY || env.OPENAI_API_KEY)
export const videoReady = () => MEDIA.video.enabled && Boolean(env.FAL_KEY)

const openai = () =>
  createOpenAI({ apiKey: env.OPENAI_API_KEY ?? "", baseURL: AGENT.baseUrls.openai })

const REFUSAL = /(content[_ ]policy|safety|moderation|not allowed|rejected)/i

const fal = () => createFalClient({ credentials: env.FAL_KEY, retry: { maxRetries: 0 } } as never)

export type Aspect = "landscape" | "portrait" | "square"
const SIZE: Record<Aspect, `${number}x${number}`> = {
  landscape: "1536x1024",
  portrait: "1024x1536",
  square: "1024x1024",
}

/**
 * One image request with `n` variants. With a source photo it's an edit (the same room, a new
 * look); without, a new image. Bytes in, bytes out.
 */
export async function makeImages(input: {
  prompt: string
  n: number
  aspect: Aspect
  source?: Uint8Array
}): Promise<{ images: Uint8Array[]; mime: string; model: string }> {
  return env.FAL_KEY ? falImages(input) : openaiImages(input)
}

type FalImage = { url: string; content_type?: string }

/** FLUX 2 on fal: the source photo goes to fal's storage, the results come back as links. */
async function falImages(input: {
  prompt: string
  n: number
  aspect: Aspect
  source?: Uint8Array
}): Promise<{ images: Uint8Array[]; mime: string; model: string }> {
  const model = input.source ? MEDIA.fal.editModel : MEDIA.fal.model
  const client = fal()
  const imageUrls = input.source
    ? [
        await client.storage.upload(
          new Blob([new Uint8Array(input.source)], { type: "image/jpeg" }),
        ),
      ]
    : undefined
  let data: { images?: FalImage[]; has_nsfw_concepts?: boolean[] }
  try {
    const result = await client.subscribe(model, {
      input: {
        prompt: input.prompt,
        ...(imageUrls ? { image_urls: imageUrls } : {}),
        num_images: input.n,
        image_size: MEDIA.fal.sizes[input.aspect],
        output_format: "jpeg",
      },
      abortSignal: AbortSignal.timeout(MEDIA.image.timeoutMs),
    } as never)
    data = result.data as typeof data
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (REFUSAL.test(message)) throw new MediaRefused()
    throw error
  }
  // A result the safety checker caught comes back blank: treat it as a refusal, not a picture.
  const kept = (data.images ?? []).filter((_, i) => !data.has_nsfw_concepts?.[i])
  if (!kept.length && data.images?.length) throw new MediaRefused()
  const images = await Promise.all(
    kept.map(async (img) => {
      const response = await fetch(img.url, { signal: AbortSignal.timeout(60_000) })
      if (!response.ok) throw new Error(`fal image download failed: ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    }),
  )
  return { images, mime: kept[0]?.content_type ?? "image/jpeg", model }
}

async function openaiImages(input: {
  prompt: string
  n: number
  aspect: Aspect
  source?: Uint8Array
}): Promise<{ images: Uint8Array[]; mime: string; model: string }> {
  const model = input.source ? MEDIA.image.editModel : MEDIA.image.model
  try {
    const result = await generateImage({
      model: openai().image(model),
      prompt: input.source ? { text: input.prompt, images: [input.source] } : input.prompt,
      n: input.n,
      size: SIZE[input.aspect],
      providerOptions: { openai: { quality: MEDIA.image.quality } },
      abortSignal: AbortSignal.timeout(MEDIA.image.timeoutMs),
      maxRetries: 1,
    })
    return {
      images: result.images.map((i) => i.uint8Array),
      mime: result.images[0]?.mediaType ?? "image/png",
      model,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (REFUSAL.test(message)) throw new MediaRefused()
    throw error
  }
}

// ── Video (fal.ai queue) ────────────────────────────────────────────────────────────────────

/** The video model for today (FLUX 3 Max on promotion until 7 Nov 2026, then Kling 3.0). */
export const videoModel = () =>
  Date.now() < Date.parse(MEDIA.video.switchAt) ? MEDIA.video.model : MEDIA.video.modelAfter

/** Sends an image-to-video request; returns at once with the provider's request id. */
export async function submitVideo(input: {
  imageUrl: string
  prompt: string
  seconds: number
  audio: boolean
}): Promise<{ requestId: string; model: string }> {
  const model = videoModel()
  const { request_id } = await fal().queue.submit(model, {
    input: {
      prompt: input.prompt,
      image_url: input.imageUrl,
      duration: String(input.seconds),
      generate_audio: input.audio,
    },
    startTimeout: MEDIA.video.startTimeoutS,
  } as never)
  return { requestId: request_id, model }
}

export type VideoState =
  | { state: "queued"; position: number | null }
  | { state: "running" }
  | { state: "done"; url: string }
  | { state: "failed"; refused: boolean; message: string }

/** Where a submitted video stands; on completion the result is read from fal (never from a payload). */
export async function videoState(model: string, requestId: string): Promise<VideoState> {
  const client = fal()
  const status = (await client.queue.status(model, { requestId, logs: false })) as {
    status: string
    queue_position?: number
  }
  if (status.status === "IN_QUEUE")
    return { state: "queued", position: status.queue_position ?? null }
  if (status.status === "IN_PROGRESS") return { state: "running" }
  try {
    const result = (await client.queue.result(model, { requestId })) as {
      data?: { video?: { url?: string } }
    }
    const url = result.data?.video?.url
    return url
      ? { state: "done", url }
      : { state: "failed", refused: false, message: "No video came back" }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { state: "failed", refused: REFUSAL.test(message), message }
  }
}

/** Uploads bytes to fal's storage (local runs, where fal can't reach our own links). */
export async function uploadForVideo(bytes: Uint8Array, mime: string): Promise<string> {
  return fal().storage.upload(new Blob([new Uint8Array(bytes)], { type: mime }))
}
