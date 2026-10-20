import { eq } from "drizzle-orm"
import type { Db } from "./index"
import { businesses, runs } from "./schema"

/**
 * A guest who signs in keeps everything they made: their rows move to the signed-in user.
 * Every owned table is listed here; a new owned table must be added (S-stages extend this).
 */
export async function reownUserData(db: Db, fromUserId: string, toUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(businesses).set({ ownerId: toUserId }).where(eq(businesses.ownerId, fromUserId))
    await tx.update(runs).set({ ownerId: toUserId }).where(eq(runs.ownerId, fromUserId))
  })
}
