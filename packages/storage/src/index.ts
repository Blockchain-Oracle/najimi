import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { STORAGE } from "@najimi/config"
import { env } from "@najimi/env/server"

/*
 * Object storage (RustFS, S3-compatible). The bucket is private and only the app talks to it:
 * browsers read through `/api/media/…` (session, share token or a signed link), and providers that
 * must fetch a photo (the chat model, video generation) get a short-lived signed link on our own
 * domain. Keys are random and never carry a user id.
 */

export class StorageNotConfigured extends Error {
  constructor() {
    super("Storage isn't set up on this server (S3_ENDPOINT and keys)")
    this.name = "StorageNotConfigured"
  }
}

export const storageReady = () =>
  Boolean(env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY)

let client: S3Client | undefined
function s3(): S3Client {
  if (!storageReady()) throw new StorageNotConfigured()
  client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    // RustFS serves buckets as paths (http://host/bucket/key), not subdomains.
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
    },
  })
  return client
}

const Bucket = STORAGE.bucket

let bucketChecked: Promise<void> | undefined
/** Creates the bucket the first time it's needed (idempotent). */
export function ensureBucket(): Promise<void> {
  bucketChecked ??= (async () => {
    try {
      await s3().send(new HeadBucketCommand({ Bucket }))
    } catch {
      await s3().send(new CreateBucketCommand({ Bucket }))
    }
  })().catch((error) => {
    bucketChecked = undefined
    throw error
  })
  return bucketChecked
}

/** A fresh random key: `<kind>/<128-bit hex>.<ext>`. */
export function newKey(kind: "uploads" | "creations", ext: string): string {
  return `${kind}/${randomBytes(16).toString("hex")}.${ext}`
}

export async function putBytes(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await ensureBucket()
  await s3().send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }))
}

export async function getBytes(key: string): Promise<Uint8Array> {
  const out = await s3().send(new GetObjectCommand({ Bucket, Key: key }))
  if (!out.Body) throw new Error(`Object ${key} has no body`)
  return out.Body.transformToByteArray()
}

/** Streams an object (or one byte range of it, for video seeking). */
export async function getStream(key: string, range?: string) {
  const out = await s3().send(new GetObjectCommand({ Bucket, Key: key, Range: range }))
  if (!out.Body) throw new Error(`Object ${key} has no body`)
  return {
    body: out.Body.transformToWebStream(),
    contentLength: out.ContentLength ?? null,
    contentRange: out.ContentRange ?? null,
  }
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  try {
    const out = await s3().send(new HeadObjectCommand({ Bucket, Key: key }))
    return { size: out.ContentLength ?? 0 }
  } catch {
    return null
  }
}

/** Deletes objects by key (rows are the source of truth; objects follow them). */
export async function deleteKeys(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 1000) {
    await s3().send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: unique.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    )
  }
}

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

// ── Signed media links ──────────────────────────────────────────────────────────────────────

export type MediaKind = "upload" | "creation"
export type MediaVariant = "original" | "display" | "thumb" | "poster"

/** The signing key is derived from the auth secret, so there's no second secret to manage. */
const signingKey = () => createHash("sha256").update(`media:${env.BETTER_AUTH_SECRET}`).digest()

const payload = (kind: MediaKind, id: string, variant: MediaVariant, exp: number) =>
  `${kind}:${id}:${variant}:${exp}`

/** The path of a media file; signed links work without a session until they expire. */
export function mediaPath(
  kind: MediaKind,
  id: string,
  variant: MediaVariant = "display",
  signed?: { ttlS?: number },
): string {
  const base = `/api/media/${kind}/${id}?v=${variant}`
  if (!signed) return base
  const exp = Math.floor(Date.now() / 1000) + (signed.ttlS ?? STORAGE.signedUrlTtlS)
  const sig = createHmac("sha256", signingKey())
    .update(payload(kind, id, variant, exp))
    .digest("base64url")
  return `${base}&exp=${exp}&sig=${sig}`
}

/** Whether a signed link is genuine and unexpired. */
export function verifyMediaSignature(
  kind: MediaKind,
  id: string,
  variant: MediaVariant,
  exp: string | null,
  sig: string | null,
): boolean {
  const expiry = Number(exp)
  if (!sig || !Number.isFinite(expiry) || expiry < Date.now() / 1000) return false
  const expected = createHmac("sha256", signingKey())
    .update(payload(kind, id, variant, expiry))
    .digest()
  const given = Buffer.from(sig, "base64url")
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * A link a provider can fetch: signed and absolute on a public https origin. On a local origin
 * (localhost) providers can't reach us, so callers fall back to sending the bytes inline.
 */
export function providerMediaUrl(
  kind: MediaKind,
  id: string,
  variant: MediaVariant = "display",
): string | null {
  const origin = new URL(env.BETTER_AUTH_URL)
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
  if (local || origin.protocol !== "https:") return null
  return new URL(mediaPath(kind, id, variant, {}), origin).toString()
}
