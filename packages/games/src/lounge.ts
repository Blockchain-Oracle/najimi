import { GAMES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"

/*
 * Najimi as a member of the app: an account of its own (no profile, so it never shows as a
 * person) that runs the public circle, the Najimi Lounge, and deals the daily drops.
 */

export const NAJIMI_USER = {
  id: "najimi",
  name: "Najimi",
  email: "najimi@najimi.xyz",
} as const

/** Najimi's account and the Lounge, made once (safe to call on every start). */
export async function ensureLounge(): Promise<string> {
  await db
    .insert(schema.user)
    .values({ ...NAJIMI_USER, emailVerified: true, isAnonymous: false })
    .onConflictDoNothing()
  const [found] = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(eq(schema.chats.inviteToken, GAMES.lounge.token))
  if (found) return found.id
  const [chat] = await db
    .insert(schema.chats)
    .values({
      ownerId: NAJIMI_USER.id,
      kind: "circle",
      name: GAMES.lounge.name,
      inviteToken: GAMES.lounge.token,
      public: true,
      locale: "en",
    })
    .onConflictDoNothing()
    .returning({ id: schema.chats.id })
  if (!chat) return ensureLounge()
  await db
    .insert(schema.chatMembers)
    .values({ chatId: chat.id, userId: NAJIMI_USER.id, role: "owner" })
    .onConflictDoNothing()
  return chat.id
}
