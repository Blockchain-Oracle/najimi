import { db, schema } from "@najimi/db"
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm"
import { ogCard } from "@/lib/og"

/** A circle invite's link preview: the circle's name, how many are in it, and what they love. */
export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!/^[a-z0-9]{8,32}$/.test(token)) return new Response("Not found", { status: 404 })
  const [circle] = await db
    .select({ id: schema.chats.id, name: schema.chats.name })
    .from(schema.chats)
    .where(and(eq(schema.chats.inviteToken, token), eq(schema.chats.kind, "circle")))
  if (!circle) return new Response("Not found", { status: 404 })
  const members = await db
    .select({ userId: schema.chatMembers.userId })
    .from(schema.chatMembers)
    .where(eq(schema.chatMembers.chatId, circle.id))
  const loves = members.length
    ? await db
        .select({ name: schema.loves.name, image: schema.loves.imageUrl })
        .from(schema.loves)
        .innerJoin(schema.people, eq(schema.people.id, schema.loves.personId))
        .where(
          and(
            inArray(
              schema.people.ownerId,
              members.map((m) => m.userId),
            ),
            eq(schema.people.isSelf, true),
            eq(schema.people.visibility, "public"),
            isNotNull(schema.loves.imageUrl),
          ),
        )
        .orderBy(desc(schema.loves.weight))
        .limit(8)
    : []
  return ogCard({
    title: circle.name ?? "A circle on Najimi",
    line: `${members.length} ${members.length === 1 ? "person" : "people"} · come in`,
    chips: loves.slice(0, 4).map((l) => l.name),
    images: loves.map((l) => l.image),
  })
}
