import { db, schema } from "@najimi/db"
import { getStream, type MediaVariant, verifyMediaSignature } from "@najimi/storage"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { fail } from "@/lib/api"
import { getSession } from "@/lib/session"

const params = z.object({ kind: z.enum(["upload", "creation"]), id: z.uuid() })
const variants = z.enum(["original", "display", "thumb", "poster"]).catch("display")

type Found = { ownerId: string; key: string | null; mime: string; open: boolean }

/** The object for a variant: creations have renditions; uploads only their re-encoded original. */
async function find(
  kind: "upload" | "creation",
  id: string,
  v: MediaVariant,
): Promise<Found | null> {
  if (kind === "upload") {
    const [u] = await db.select().from(schema.uploads).where(eq(schema.uploads.id, id))
    return u ? { ownerId: u.ownerId, key: u.s3Key, mime: u.mime, open: u.sample } : null
  }
  const [c] = await db.select().from(schema.creations).where(eq(schema.creations.id, id))
  if (c?.status !== "ready") return null
  const key =
    v === "thumb"
      ? (c.thumbKey ?? c.displayKey ?? c.s3Key)
      : v === "poster"
        ? c.posterKey
        : v === "display"
          ? (c.displayKey ?? c.s3Key)
          : c.s3Key
  const still = v === "thumb" || v === "poster" || (v === "display" && c.kind === "image")
  const mime = still
    ? key === c.s3Key
      ? (c.mime ?? "image/jpeg")
      : "image/webp"
    : (c.mime ?? "video/mp4")
  return { ownerId: c.ownerId, key, mime, open: c.public }
}

/**
 * Whether a live share link covers this creation: a link to the creation itself, or to the chat it
 * was made in (a shared chat shows its results, never the person's own photos).
 */
async function sharedCreation(id: string, token: string | null): Promise<boolean> {
  if (!token) return false
  const [share] = await db
    .select()
    .from(schema.shares)
    .where(and(eq(schema.shares.token, token), isNull(schema.shares.revokedAt)))
  if (!share) return false
  if (share.kind === "creation") return share.refId === id
  if (share.kind !== "chat") return false
  const [c] = await db
    .select({ chatId: schema.creations.chatId })
    .from(schema.creations)
    .where(eq(schema.creations.id, id))
  return c?.chatId === share.refId
}

/**
 * Photos and creations, streamed from private storage. Readable by their owner, by anyone holding
 * a signed link (providers, for a few hours) or a live share token (creations only, never the
 * person's own photo), or by everyone when public (samples, workflow covers).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[kind]/[id]">) {
  const parsed = params.safeParse(await ctx.params)
  if (!parsed.success) return fail("Not found", 404)
  const { kind, id } = parsed.data
  const url = new URL(request.url)
  const v = variants.parse(url.searchParams.get("v"))
  const found = await find(kind, id, v)
  if (!found?.key) return fail("Not found", 404)

  const signed = verifyMediaSignature(
    kind,
    id,
    v,
    url.searchParams.get("exp"),
    url.searchParams.get("sig"),
  )
  let allowed = found.open || signed
  if (!allowed && kind === "creation")
    allowed = await sharedCreation(id, url.searchParams.get("share"))
  if (!allowed) {
    const session = await getSession()
    allowed = session?.user.id === found.ownerId
  }
  if (!allowed) return fail("Not found", 404)

  const range = request.headers.get("range") ?? undefined
  const object = await getStream(found.key, range)
  const headers = new Headers({
    "content-type": found.mime,
    "x-content-type-options": "nosniff",
    // Keys are random and never rewritten, so a copy never goes stale.
    "cache-control": found.open
      ? "public, max-age=31536000, immutable"
      : "private, max-age=31536000, immutable",
    "accept-ranges": "bytes",
  })
  if (object.contentLength !== null) headers.set("content-length", String(object.contentLength))
  if (object.contentRange) headers.set("content-range", object.contentRange)
  return new Response(object.body, { status: object.contentRange ? 206 : 200, headers })
}
