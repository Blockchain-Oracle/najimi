import { db, schema } from "@najimi/db"
import { emailReady, reportEmail, sendEmail } from "@najimi/email"
import { env } from "@najimi/env/server"
import { and, eq } from "drizzle-orm"
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
  // A reported message: only from a room you're in; its author is who the report is about.
  let message: string | null = null
  let targetId = r.targetId ?? null
  if (r.messageId) {
    if (!r.chatId) return fail("Which chat?", 400)
    const [row] = await db
      .select({ authorId: schema.messages.authorId, parts: schema.messages.parts })
      .from(schema.messages)
      .innerJoin(
        schema.chatMembers,
        and(
          eq(schema.chatMembers.chatId, schema.messages.chatId),
          eq(schema.chatMembers.userId, me),
        ),
      )
      .where(and(eq(schema.messages.id, r.messageId), eq(schema.messages.chatId, r.chatId)))
    if (!row) return fail("Unknown message", 404)
    targetId = row.authorId ?? targetId
    message = (row.parts as { type?: string; text?: string }[])
      .flatMap((p) => (p.type === "text" && p.text ? [p.text] : []))
      .join(" ")
      .slice(0, 400)
  }
  await db.insert(schema.reports).values({
    reporterId: me,
    targetId,
    messageId: r.messageId ?? null,
    chatId: r.chatId ?? null,
    reason: r.reason,
    note: r.note ?? null,
  })
  if (targetId && targetId !== me)
    await db
      .insert(schema.blocks)
      .values({ blockerId: me, blockedId: targetId })
      .onConflictDoNothing()
  // The owner reviews every report (once email is set up).
  if (env.REPORTS_EMAIL && emailReady()) {
    const [who] = targetId
      ? await db
          .select({ username: schema.user.displayUsername, name: schema.user.name })
          .from(schema.user)
          .where(eq(schema.user.id, targetId))
      : []
    const mail = reportEmail({
      reason: r.reason,
      note: r.note ?? null,
      target: who ? `${who.name}${who.username ? ` (@${who.username})` : ""}` : targetId,
      message,
    })
    await sendEmail({ to: env.REPORTS_EMAIL, ...mail }).catch((e) =>
      console.error("[report] email", e),
    )
  }
  return json({ ok: true })
}
