import "server-only"
import { db } from "@najimi/db"
import { deleteUserData } from "@najimi/db/owned"
import { enqueue } from "@najimi/jobs"
import { deleteKeys } from "@najimi/storage"

/**
 * "Delete all my data" (T21): every row goes in one transaction, then the stored photos and
 * creations. If storage is down, the worker finishes the objects later (a retried job); the rows,
 * and so every way to reach the objects, are already gone.
 */
export async function forgetUser(userId: string): Promise<{ objects: number }> {
  const keys = await deleteUserData(db, userId)
  if (keys.length) {
    await deleteKeys(keys).catch(async (error) => {
      console.error("[forget] storage, the worker retries", error)
      for (let i = 0; i < keys.length; i += 5000)
        await enqueue("storageDelete", { keys: keys.slice(i, i + 5000) })
    })
  }
  return { objects: keys.length }
}
