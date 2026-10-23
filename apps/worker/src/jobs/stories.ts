import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { STORIES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { publish, topic } from "@najimi/live"
import { deleteKeys, getBytes, newKey, putBytes, sha256 } from "@najimi/storage"
import { eq, inArray, lt } from "drizzle-orm"

/*
 * Stories in the worker: a video story is made phone-ready (H.264 + AAC in an MP4 that starts
 * playing before it's all loaded, scaled to fit 1080×1920, at most a minute) with a poster from
 * half a second in; and every hour, stories past their day go with their files.
 */

const run = (cmd: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let err = ""
    child.stdout.on("data", (d) => {
      out += d
    })
    child.stderr.on("data", (d) => {
      err += d
    })
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} ${code}: ${err.slice(-400)}`)),
    )
  })

export async function storyVideo(storyId: string) {
  const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, storyId))
  if (!story?.uploadId || story.status !== "processing") return
  const [raw] = await db.select().from(schema.uploads).where(eq(schema.uploads.id, story.uploadId))
  if (!raw) return
  const dir = await mkdtemp(join(tmpdir(), "story-"))
  try {
    const input = join(dir, "in")
    const output = join(dir, "out.mp4")
    const poster = join(dir, "poster.jpg")
    await writeFile(input, await getBytes(raw.s3Key))
    const edge = STORIES.video.maxEdge
    await run("ffmpeg", [
      "-y",
      "-i",
      input,
      "-t",
      String(STORIES.video.maxSeconds),
      "-vf",
      `scale='if(gt(iw,ih),min(${edge},iw),-2)':'if(gt(iw,ih),-2,min(${edge},ih))'`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      output,
    ])
    await run("ffmpeg", ["-y", "-ss", "0.5", "-i", output, "-frames:v", "1", "-q:v", "3", poster])
    const [w, h] = (
      await run("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0",
        output,
      ])
    )
      .trim()
      .split(",")
      .map(Number)
    const video = new Uint8Array(await readFile(output))
    const still = new Uint8Array(await readFile(poster))
    const videoKey = newKey("uploads", "mp4")
    const posterKey = newKey("uploads", "jpg")
    await putBytes(videoKey, video, "video/mp4")
    await putBytes(posterKey, still, "image/jpeg")
    await db
      .update(schema.uploads)
      .set({
        s3Key: videoKey,
        mime: "video/mp4",
        width: w || 0,
        height: h || 0,
        bytes: video.byteLength,
        sha256: sha256(video),
        status: "ready",
      })
      .where(eq(schema.uploads.id, raw.id))
    const [still_] = await db
      .insert(schema.uploads)
      .values({
        ownerId: story.ownerId,
        s3Key: posterKey,
        mime: "image/jpeg",
        width: w || 0,
        height: h || 0,
        bytes: still.byteLength,
        sha256: sha256(still),
      })
      .returning({ id: schema.uploads.id })
    await db
      .update(schema.stories)
      .set({ status: "ready", posterId: still_?.id ?? null })
      .where(eq(schema.stories.id, story.id))
    await deleteKeys([raw.s3Key]).catch(() => null)
    await publish(topic.user(story.ownerId), "story", { id: story.id, status: "ready" })
  } catch (error) {
    console.error("[stories] video", error)
    await db.update(schema.stories).set({ status: "failed" }).where(eq(schema.stories.id, story.id))
    await publish(topic.user(story.ownerId), "story", { id: story.id, status: "failed" })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Stories past their day, and their photos, videos and posters. */
export async function storiesExpire() {
  const gone = await db
    .delete(schema.stories)
    .where(lt(schema.stories.expiresAt, new Date()))
    .returning({ uploadId: schema.stories.uploadId, posterId: schema.stories.posterId })
  const ids = gone.flatMap((g) => [g.uploadId, g.posterId].filter((x): x is string => Boolean(x)))
  if (!ids.length) return
  const files = await db
    .delete(schema.uploads)
    .where(inArray(schema.uploads.id, ids))
    .returning({ key: schema.uploads.s3Key })
  await deleteKeys(files.map((f) => f.key)).catch((error) =>
    console.error("[stories] files", error),
  )
}
