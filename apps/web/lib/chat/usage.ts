import "server-only"
import { ALLOWANCE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { sql } from "drizzle-orm"

const today = () => new Date().toISOString().slice(0, 10)
export type Counter = "turns" | "images" | "videos"

const limitOf = (counter: Counter, guest: boolean) =>
  (guest ? ALLOWANCE.guest : ALLOWANCE.member)[counter]

/**
 * Takes `n` from today's allowance, atomically: the row only moves when it stays within the limit,
 * so two tabs can't both take the last one. Images and videos also take from the server's own
 * daily ceiling (`user_id = '*'`). Returns false when there isn't enough left.
 */
export async function charge(
  userId: string,
  guest: boolean,
  counter: Counter,
  n = 1,
): Promise<boolean> {
  return db
    .transaction(async (tx) => {
      const take = async (id: string, limit: number) => {
        const col = schema.usageDays[counter]
        const rows = await tx
          .insert(schema.usageDays)
          .values({ userId: id, day: today(), [counter]: n })
          .onConflictDoUpdate({
            target: [schema.usageDays.userId, schema.usageDays.day],
            set: { [counter]: sql`${col} + ${n}` },
            setWhere: sql`${col} + ${n} <= ${limit}`,
          })
          .returning({ value: col })
        return rows.length > 0 && (rows[0]?.value ?? 0) <= limit
      }
      if (!(await take(userId, limitOf(counter, guest)))) return false
      if (counter !== "turns" && !(await take("*", ALLOWANCE.global[counter]))) {
        tx.rollback()
      }
      return true
    })
    .catch(() => false)
}

/** Gives back what a failed or refused job took. */
export async function refund(userId: string, counter: Counter, n = 1): Promise<void> {
  const col = schema.usageDays[counter]
  for (const id of counter === "turns" ? [userId] : [userId, "*"]) {
    await db
      .update(schema.usageDays)
      .set({ [counter]: sql`greatest(${col} - ${n}, 0)` })
      .where(sql`${schema.usageDays.userId} = ${id} and ${schema.usageDays.day} = ${today()}`)
  }
}

export async function usageToday(userId: string) {
  const [row] = await db
    .select()
    .from(schema.usageDays)
    .where(sql`${schema.usageDays.userId} = ${userId} and ${schema.usageDays.day} = ${today()}`)
  return { turns: row?.turns ?? 0, images: row?.images ?? 0, videos: row?.videos ?? 0 }
}
