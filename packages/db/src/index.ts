import { DB } from "@najimi/config"
import { env } from "@najimi/env/server"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Reuse one pool across Next.js dev reloads instead of opening a new one per edit.
const globalForDb = globalThis as unknown as { najimiSql?: postgres.Sql }

// Postgres NOTICEs ("already exists, skipping" on every migration run) are noise; warnings stay.
const sql =
  globalForDb.najimiSql ??
  postgres(env.DATABASE_URL, {
    max: DB.poolMax,
    onnotice: (notice) => {
      if (notice.severity !== "NOTICE") console.warn("[db]", notice.message)
    },
  })
if (env.NODE_ENV !== "production") globalForDb.najimiSql = sql

export const db = drizzle(sql, { schema, casing: "snake_case" })
/** The raw client, for LISTEN / NOTIFY. */
export const pg = sql
export type Db = typeof db
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
export { schema }
