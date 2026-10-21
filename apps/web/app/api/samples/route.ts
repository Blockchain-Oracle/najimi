import { db, schema } from "@najimi/db"
import { asc, eq } from "drizzle-orm"
import { json } from "@/lib/api"

/** The sample rooms anyone can restyle (public photos shipped with the app). */
export async function GET() {
  const rows = await db
    .select({
      id: schema.uploads.id,
      key: schema.uploads.s3Key,
      width: schema.uploads.width,
      height: schema.uploads.height,
    })
    .from(schema.uploads)
    .where(eq(schema.uploads.sample, true))
    .orderBy(asc(schema.uploads.createdAt))
  return json({
    samples: rows.map((r) => ({
      id: r.id,
      name: /sample-(\w+)\./.exec(r.key)?.[1] ?? "room",
      url: `/api/media/upload/${r.id}?v=original`,
      width: r.width,
      height: r.height,
    })),
  })
}
