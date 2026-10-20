import { migrateDatabase } from "@najimi/db/migrate"

/** One-shot migration (compose's `migrate` service runs this before web and worker start). */
migrateDatabase()
  .then(() => {
    console.log("[migrate] database is up to date")
    process.exit(0)
  })
  .catch((error) => {
    console.error("[migrate] failed", error)
    process.exit(1)
  })
