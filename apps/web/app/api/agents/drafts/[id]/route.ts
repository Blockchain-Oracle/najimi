import { connectionOf, secretOf } from "@najimi/connectors/sessions"
import { xPost } from "@najimi/connectors/x"
import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"

const input = z.object({
  action: z.enum(["post", "skip"]),
  /** The words as the person left them, if they changed the draft. */
  text: z.string().trim().min(1).max(280).optional(),
})

/** Posts a ready draft with the person's own X account (their yes), or sets it aside. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  const id = (await ctx.params).id
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const [draft] = await db
    .select()
    .from(schema.postDrafts)
    .where(and(eq(schema.postDrafts.id, id), eq(schema.postDrafts.userId, me)))
  if (draft?.status !== "ready") return fail("That draft isn't waiting any more", 404)
  if (parsed.data.action === "skip") {
    await db
      .update(schema.postDrafts)
      .set({ status: "skipped" })
      .where(eq(schema.postDrafts.id, id))
    return json({ status: "skipped" })
  }
  if (draft.platform !== "x")
    return fail("Instagram posts need a picture: copy the words and post it there", 409)
  const c = await connectionOf(me, "x")
  if (c?.status !== "active") return fail("Connect your X first", 409)
  const text = parsed.data.text ?? draft.text
  try {
    const posted = await xPost(secretOf(c), text)
    await db
      .update(schema.postDrafts)
      .set({ status: "posted", text, url: posted.url, postedAt: new Date() })
      .where(eq(schema.postDrafts.id, id))
    await db.insert(schema.socialActions).values({
      userId: me,
      platform: "x",
      kind: "post",
      target: posted.id,
      label: text.slice(0, 80),
      status: "done",
      url: posted.url,
    })
    return json({ status: "posted", url: posted.url })
  } catch (e) {
    return fail((e as Error).message || "X didn't take the post", 502)
  }
}
