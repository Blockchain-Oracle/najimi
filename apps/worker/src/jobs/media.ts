import { MEDIA } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { emit, setRunStatus } from "@najimi/live"
import { MediaRefused, makeImages, submitVideo, uploadForVideo, videoState } from "@najimi/media"
import { getBytes, newKey, providerMediaUrl, putBytes } from "@najimi/storage"
import { and, eq, inArray, sql } from "drizzle-orm"
import sharp from "sharp"

type Job = typeof schema.mediaJobs.$inferSelect
type Counter = "images" | "videos"
const today = () => new Date().toISOString().slice(0, 10)

/** Gives back what a failed or refused request took from today's allowance (the user's and the server's). */
async function refund(userId: string, counter: Counter, n: number) {
  if (n <= 0) return
  const col = schema.usageDays[counter]
  for (const id of [userId, "*"])
    await db
      .update(schema.usageDays)
      .set({ [counter]: sql`greatest(${col} - ${n}, 0)` })
      .where(and(eq(schema.usageDays.userId, id), eq(schema.usageDays.day, today())))
}

/** Stores an image three ways: the original (JPEG), a 1600 px display and a 480 px thumbnail (WebP). */
async function storeImage(bytes: Uint8Array) {
  const base = sharp(Buffer.from(bytes)).rotate()
  const meta = await base.metadata()
  const [original, display, thumb] = await Promise.all([
    base.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
    base
      .clone()
      .resize({ width: MEDIA.renditions.display, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(),
    base
      .clone()
      .resize({ width: MEDIA.renditions.thumb, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer(),
  ])
  const keys = {
    s3Key: newKey("creations", "jpg"),
    displayKey: newKey("creations", "webp"),
    thumbKey: newKey("creations", "webp"),
  }
  await Promise.all([
    putBytes(keys.s3Key, new Uint8Array(original), "image/jpeg"),
    putBytes(keys.displayKey, new Uint8Array(display), "image/webp"),
    putBytes(keys.thumbKey, new Uint8Array(thumb), "image/webp"),
  ])
  return { ...keys, mime: "image/jpeg", width: meta.width ?? null, height: meta.height ?? null }
}

async function fail(job: Job, reason: string, refused: boolean, counter: Counter, n: number) {
  await db
    .update(schema.mediaJobs)
    .set({ status: refused ? "refused" : "failed", error: reason })
    .where(eq(schema.mediaJobs.id, job.id))
  await db
    .update(schema.creations)
    .set({ status: refused ? "refused" : "failed", error: reason })
    .where(and(eq(schema.creations.mediaJobId, job.id), eq(schema.creations.status, "pending")))
  await refund(job.ownerId, counter, n)
  if (job.runId) await setRunStatus(job.runId, "failed", refused ? "refused" : reason)
}

/** The source image's bytes: a person's photo, or an earlier creation (a variation, a video frame). */
async function sourceBytes(
  input: Record<string, unknown>,
  ownerId: string,
): Promise<Uint8Array | undefined> {
  if (typeof input.sourceUploadId === "string") {
    const [u] = await db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.id, input.sourceUploadId))
    if (u && (u.ownerId === ownerId || u.sample)) return getBytes(u.s3Key)
  }
  if (typeof input.sourceCreationId === "string") {
    const [c] = await db
      .select()
      .from(schema.creations)
      .where(eq(schema.creations.id, input.sourceCreationId))
    if (c?.ownerId === ownerId && c.s3Key) return getBytes(c.s3Key)
  }
  return undefined
}

/** One media request: images are made and stored here; a video is submitted for the poller. */
export async function mediaGenerate(jobId: string): Promise<void> {
  const [job] = await db.select().from(schema.mediaJobs).where(eq(schema.mediaJobs.id, jobId))
  if (job?.status !== "queued") return
  const runId = job.runId
  const input = job.input as Record<string, unknown>
  const creations = await db
    .select()
    .from(schema.creations)
    .where(eq(schema.creations.mediaJobId, job.id))
    .orderBy(schema.creations.createdAt)
  await db
    .update(schema.mediaJobs)
    .set({ status: "running", attempts: job.attempts + 1, submittedAt: new Date() })
    .where(eq(schema.mediaJobs.id, job.id))
  if (runId) await setRunStatus(runId, "running")

  if (job.kind === "image") {
    if (runId) await emit(runId, "progress", { stage: "making" })
    try {
      const source = await sourceBytes(input, job.ownerId)
      const made = await makeImages({
        prompt: String(input.prompt),
        n: creations.length,
        aspect: (input.aspect as "landscape" | "portrait" | "square") ?? "landscape",
        source,
      })
      for (const [i, creation] of creations.entries()) {
        const bytes = made.images[i]
        if (!bytes) continue
        const stored = await storeImage(bytes)
        await db
          .update(schema.creations)
          .set({ ...stored, status: "ready" })
          .where(eq(schema.creations.id, creation.id))
        if (runId) await emit(runId, "asset", { creationId: creation.id, index: i })
      }
      const missing = creations.length - made.images.length
      if (missing > 0) {
        await db
          .update(schema.creations)
          .set({ status: "failed", error: "Not made" })
          .where(
            inArray(
              schema.creations.id,
              creations.slice(made.images.length).map((c) => c.id),
            ),
          )
        await refund(job.ownerId, "images", missing)
      }
      await db
        .update(schema.mediaJobs)
        .set({ status: "done", model: made.model })
        .where(eq(schema.mediaJobs.id, job.id))
      if (runId) await setRunStatus(runId, "done")
    } catch (error) {
      const refused = error instanceof MediaRefused
      await fail(
        job,
        refused ? "refused" : (error as Error).message.slice(0, 300),
        refused,
        "images",
        creations.length,
      )
    }
    return
  }

  // Video: the provider fetches the still from a signed link on our domain (or fal storage locally).
  try {
    const fromId = String(input.sourceCreationId ?? "")
    const [from] = await db.select().from(schema.creations).where(eq(schema.creations.id, fromId))
    let imageUrl = from ? providerMediaUrl("creation", from.id, "display") : null
    if (!imageUrl) {
      const bytes = await sourceBytes(input, job.ownerId)
      if (!bytes) throw new Error("Nothing to animate")
      imageUrl = await uploadForVideo(bytes, "image/jpeg")
    }
    const { requestId, model } = await submitVideo({
      imageUrl,
      prompt: String(input.prompt),
      seconds: Number(input.seconds ?? MEDIA.video.seconds),
      audio: Boolean(input.audio),
    })
    await db
      .update(schema.mediaJobs)
      .set({ status: "submitted", providerRequestId: requestId, model })
      .where(eq(schema.mediaJobs.id, job.id))
    if (from)
      await db
        .update(schema.creations)
        .set({ posterKey: from.displayKey })
        .where(eq(schema.creations.mediaJobId, job.id))
    if (runId) {
      await setRunStatus(runId, "waiting")
      await emit(runId, "progress", { stage: "queued" })
    }
  } catch (error) {
    await fail(job, (error as Error).message.slice(0, 300), false, "videos", 1)
  }
}

let polling = false
/**
 * Checks every submitted video (every few seconds, from the worker): progress goes to the card;
 * a finished one is copied into our storage (provider links expire) and shown.
 */
export async function pollVideos(): Promise<void> {
  if (polling) return
  polling = true
  try {
    const open = await db
      .select()
      .from(schema.mediaJobs)
      .where(
        and(
          eq(schema.mediaJobs.kind, "video"),
          inArray(schema.mediaJobs.status, ["submitted", "running"]),
        ),
      )
    for (const job of open) {
      if (!job.providerRequestId) continue
      const state = await videoState(job.model, job.providerRequestId).catch(() => null)
      if (!state) continue
      if (state.state === "queued" || state.state === "running") {
        if (state.state === "running" && job.status !== "running")
          await db
            .update(schema.mediaJobs)
            .set({ status: "running" })
            .where(eq(schema.mediaJobs.id, job.id))
        if (job.runId)
          await emit(job.runId, "progress", {
            stage: state.state,
            position: "position" in state ? state.position : null,
          })
        continue
      }
      if (state.state === "failed") {
        await fail(job, state.message.slice(0, 300), state.refused, "videos", 1)
        continue
      }
      const response = await fetch(state.url, { signal: AbortSignal.timeout(120_000) })
      if (!response.ok) continue
      const bytes = new Uint8Array(await response.arrayBuffer())
      const key = newKey("creations", "mp4")
      await putBytes(key, bytes, "video/mp4")
      const [creation] = await db
        .update(schema.creations)
        .set({
          status: "ready",
          s3Key: key,
          displayKey: key,
          mime: "video/mp4",
          durationS: Number((job.input as { seconds?: number }).seconds ?? MEDIA.video.seconds),
        })
        .where(eq(schema.creations.mediaJobId, job.id))
        .returning({ id: schema.creations.id })
      await db
        .update(schema.mediaJobs)
        .set({ status: "done" })
        .where(eq(schema.mediaJobs.id, job.id))
      if (job.runId) {
        if (creation) await emit(job.runId, "asset", { creationId: creation.id, index: 0 })
        await setRunStatus(job.runId, "done")
      }
    }
  } finally {
    polling = false
  }
}
