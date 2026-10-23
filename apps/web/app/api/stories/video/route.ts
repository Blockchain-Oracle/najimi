import { STORIES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { newKey, putBytes, sha256, storageReady } from "@najimi/storage"
import { fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

/**
 * A video for a story, kept privately as it came; the worker makes the phone-ready copy (and its
 * poster) once the story is posted, and the original is dropped.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const userId = auth.session.user.id
  if (!storageReady()) return fail("Storage isn't set up on this server yet", 503)
  if (!allow(`story-video:${userId}`, 6, 60_000)) return fail("Slow down a little", 429)
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return fail("Add a video", 400)
  if (file.size > STORIES.video.maxBytes) return fail("That video is over 80 MB", 413)
  const ext = EXT[file.type]
  if (!ext) return fail("Use an MP4, MOV or WebM video", 415)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const key = newKey("uploads", ext)
  await putBytes(key, bytes, file.type)
  const [row] = await db
    .insert(schema.uploads)
    .values({
      ownerId: userId,
      s3Key: key,
      mime: file.type,
      width: 0,
      height: 0,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      status: "pending",
    })
    .returning({ id: schema.uploads.id })
  if (!row) return fail("Couldn't save the video", 500)
  return json({ id: row.id }, 201)
}
