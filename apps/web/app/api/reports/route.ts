import { db, schema } from "@najimi/db"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

const input = z
  .object({
    targetId: z.string().min(1).max(64).optional(),
    messageId: z.string().min(1).max(120).optional(),
    chatId: z.uuid().optional(),
    reason: z.enum(["spam", "abuse", "fake", "other"]),
    note: z.string().max(500).optional(),
  })
  .refine((r) => r.targetId || r.messageId, "Say who or what")

/** A report about a person or a message (W25): kept for review, and the person is blocked. */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  if (!allow(`report:${me}`, 10, 60 * 60_000)) return fail("That's enough reports for now", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const r = parsed.data
  await db.insert(schema.reports).values({
    reporterId: me,
    targetId: r.targetId ?? null,
    messageId: r.messageId ?? null,
    chatId: r.chatId ?? null,
    reason: r.reason,
    note: r.note ?? null,
  })
  if (r.targetId && r.targetId !== me)
    await db
      .insert(schema.blocks)
      .values({ blockerId: me, blockedId: r.targetId })
      .onConflictDoNothing()
  return json({ ok: true })
}
