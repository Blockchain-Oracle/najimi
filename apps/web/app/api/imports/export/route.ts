import { IMPORTS, TASTE_DOMAINS } from "@najimi/config"
import { resolve } from "@najimi/connectors"
import { EXPORT_MAX } from "@najimi/connectors/exports"
import { db, schema } from "@najimi/db"
import { z } from "zod"
import type { LoveHit } from "@/app/api/qloo/search/route"
import { body, fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

const input = z.object({
  platform: z.enum(["instagram", "tiktok", "spotify", "youtube", "x"]),
  candidates: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        type: z
          .string()
          .regex(/^urn:entity:[a-z_]+$/)
          .nullable(),
        external: z
          .object({
            kind: z.enum(["instagram", "twitter"]),
            id: z.string().regex(/^[a-z0-9_.]{1,30}$/),
          })
          .optional(),
        exactName: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(EXPORT_MAX),
})

/**
 * What an export held (handles, artist and channel names, read on the person's device) matched to
 * Qloo, to keep or drop. Nothing is saved here.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!allow(`import:${auth.session.user.id}`, IMPORTS.perMinute, 60_000))
    return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const found = await resolve(parsed.data.candidates, {
    userId: auth.session.user.id,
    purpose: `Import from ${parsed.data.platform}`,
  })
  const known = new Set<string>(TASTE_DOMAINS.map((d) => d.type))
  const hits: (LoveHit & { from: string })[] = found
    .filter((f) => known.has(f.type))
    .slice(0, 40)
    .map((f) => ({
      qlooId: f.qlooId,
      type: f.type,
      name: f.name,
      image: f.image,
      caption: f.caption,
      from: f.from,
    }))
  // The feed's card shows when its data last came in.
  if (parsed.data.platform !== "spotify")
    await db
      .insert(schema.socialActions)
      .values({
        userId: auth.session.user.id,
        platform: parsed.data.platform,
        kind: "read",
        target: "import",
        label: `${hits.length} found`,
        status: "done",
      })
      .catch(() => undefined)
  return json({ hits, tried: parsed.data.candidates.length })
}
