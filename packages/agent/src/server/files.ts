import { db, schema } from "@najimi/db"
import { getBytes, providerMediaUrl } from "@najimi/storage"
import { and, eq, inArray, or } from "drizzle-orm"
import type { NajimiUIMessage } from "../ui-message"

const UPLOAD = /^\/api\/media\/upload\/([0-9a-f-]{36})\?v=(original|display)$/

/** Whether every upload id is the user's own (or one of the sample photos shipped with the app). */
export async function ownsUploads(userId: string, ids: string[]): Promise<boolean> {
  if (!ids.length) return true
  const rows = await db
    .select({ id: schema.uploads.id })
    .from(schema.uploads)
    .where(
      and(
        inArray(schema.uploads.id, ids),
        or(eq(schema.uploads.ownerId, userId), eq(schema.uploads.sample, true)),
      ),
    )
  return rows.length === new Set(ids).size
}

/**
 * The model can't open our session-checked photo links, so on a copy of the messages each photo
 * becomes a short-lived signed link on our own domain (or, on a local origin providers can't
 * reach, the bytes inline). The stored chat keeps our plain links.
 */
export async function forModel(
  userId: string,
  messages: NajimiUIMessage[],
): Promise<NajimiUIMessage[]> {
  const inline = new Map<string, string>()
  return Promise.all(
    messages.map(async (m) => ({
      ...m,
      parts: await Promise.all(
        m.parts.map(async (p) => {
          if (p.type !== "file") return p
          const id = UPLOAD.exec(p.url)?.[1]
          if (!id) return p
          const signed = providerMediaUrl("upload", id, "original")
          if (signed) return { ...p, url: signed }
          if (!inline.has(id)) {
            const [row] = await db
              .select()
              .from(schema.uploads)
              .where(
                and(
                  eq(schema.uploads.id, id),
                  or(eq(schema.uploads.ownerId, userId), eq(schema.uploads.sample, true)),
                ),
              )
            if (!row) return p
            inline.set(
              id,
              `data:${row.mime};base64,${Buffer.from(await getBytes(row.s3Key)).toString("base64")}`,
            )
          }
          return { ...p, url: inline.get(id) as string }
        }),
      ),
    })),
  )
}
