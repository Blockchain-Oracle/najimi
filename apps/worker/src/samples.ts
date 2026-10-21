import { readFileSync } from "node:fs"
import { db, schema } from "@najimi/db"
import { putBytes, sha256, storageReady } from "@najimi/storage"
import { and, eq } from "drizzle-orm"
import sharp from "sharp"

/** The sample rooms shipped with the app, for anyone without a photo to hand (judges, first runs). */
export const SAMPLES = ["living", "desk", "bedroom"] as const
const OWNER = "najimi-samples"

/** Puts the sample rooms into storage once (idempotent: matched by content hash). */
export async function seedSamples(): Promise<void> {
  if (!storageReady()) return
  await db
    .insert(schema.user)
    .values({
      id: OWNER,
      name: "Najimi samples",
      email: "samples@najimi.invalid",
      emailVerified: true,
    })
    .onConflictDoNothing()
  for (const name of SAMPLES) {
    const bytes = new Uint8Array(readFileSync(new URL(`../samples/${name}.jpg`, import.meta.url)))
    const hash = sha256(bytes)
    const [exists] = await db
      .select({ id: schema.uploads.id })
      .from(schema.uploads)
      .where(and(eq(schema.uploads.sha256, hash), eq(schema.uploads.sample, true)))
    if (exists) continue
    const meta = await sharp(Buffer.from(bytes)).metadata()
    const key = `uploads/sample-${name}.jpg`
    await putBytes(key, bytes, "image/jpeg")
    await db.insert(schema.uploads).values({
      ownerId: OWNER,
      s3Key: key,
      mime: "image/jpeg",
      width: meta.width ?? 1600,
      height: meta.height ?? 1067,
      bytes: bytes.byteLength,
      sha256: hash,
      sample: true,
    })
  }
}
