import { AUTH } from "@najimi/config"
import { db } from "@najimi/db"
import { deleteUserData, idleGuests } from "@najimi/db/owned"
import { enqueue } from "@najimi/jobs"
import { deleteKeys } from "@najimi/storage"

/** Deletes stored objects now; if storage is down, a retried job finishes it later. */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (!keys.length) return
  try {
    await deleteKeys(keys)
  } catch (error) {
    console.error("[forget] storage, retrying later", error)
    for (let i = 0; i < keys.length; i += 5000)
      await enqueue("storageDelete", { keys: keys.slice(i, i + 5000) })
  }
}

/**
 * The nightly sweep (T21): guests nobody has used for a month go, with their photos and
 * creations. A guest who signed in became a member and is never swept.
 */
export async function guestsCleanup(): Promise<void> {
  const ids = await idleGuests(db, AUTH.guestKeepDays, AUTH.guestSweepBatch)
  const keys: string[] = []
  for (const id of ids) keys.push(...(await deleteUserData(db, id)))
  await deleteObjects(keys)
  if (ids.length) console.log(`[forget] swept ${ids.length} idle guests, ${keys.length} objects`)
}
