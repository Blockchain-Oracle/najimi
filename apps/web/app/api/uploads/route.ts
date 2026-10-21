import { UPLOAD } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { mediaPath, newKey, putBytes, sha256, storageReady } from "@najimi/storage"
import sharp, { type OutputInfo } from "sharp"
import { fail, json, withSession } from "@/lib/api"

/**
 * A photo someone adds (T5). The browser has already resized it (and turned HEIC into JPEG); here
 * it is decoded for real, turned upright, re-encoded as JPEG (which drops EXIF, GPS included) and
 * stored privately under a random key. Only the re-encoded copy is ever kept.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!storageReady()) return fail("Photo storage isn't set up on this server yet", 503)

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return fail("Add a photo", 400)
  if (file.size > UPLOAD.maxBytes) return fail("That photo is over 10 MB", 413)
  if (!(UPLOAD.mimes as readonly string[]).includes(file.type))
    return fail("Use a JPEG, PNG or WebP photo", 415)

  let encoded: { data: Buffer; info: OutputInfo }
  try {
    encoded = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" })
      .rotate()
      .resize({
        width: UPLOAD.maxEdge,
        height: UPLOAD.maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: UPLOAD.jpegQuality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })
  } catch {
    return fail("That file isn't a photo we can read", 415)
  }

  const bytes = new Uint8Array(encoded.data)
  const key = newKey("uploads", "jpg")
  await putBytes(key, bytes, "image/jpeg")
  const [row] = await db
    .insert(schema.uploads)
    .values({
      ownerId: auth.session.user.id,
      s3Key: key,
      mime: "image/jpeg",
      width: encoded.info.width,
      height: encoded.info.height,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    })
    .returning({ id: schema.uploads.id })
  if (!row) return fail("Couldn't save the photo", 500)
  return json({
    id: row.id,
    url: mediaPath("upload", row.id, "original"),
    width: encoded.info.width,
    height: encoded.info.height,
  })
}
