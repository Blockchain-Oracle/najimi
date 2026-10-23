import { db, schema } from "@najimi/db"
import type { SocialPlatform } from "@najimi/db/schema"
import { env } from "@najimi/env/server"
import { and, eq, ne } from "drizzle-orm"
import { boundOf, openWith, sealWith } from "./vault"

/*
 * Connected social accounts. A session is sealed the moment it arrives and only opened here, in
 * server code that is about to call the platform; the screen only ever sees who it's connected as.
 */

export const vaultReady = () => Boolean(env.CONNECTOR_SECRET)

export type Connection = typeof schema.connectorSessions.$inferSelect

/** What the screen may know about a connection. */
export type ConnectionView = {
  platform: SocialPlatform
  handle: string | null
  name: string | null
  image: string | null
  status: Connection["status"]
  autopilot: boolean
  likes: boolean
  posts: Connection["posts"]
  pausedUntil: string | null
  lastError: string | null
  lastUsedAt: string | null
}

export const viewOf = (c: Connection): ConnectionView => ({
  platform: c.platform,
  handle: c.handle,
  name: c.name,
  image: c.image,
  status: c.status,
  autopilot: c.autopilot,
  likes: c.likes,
  posts: c.posts,
  pausedUntil: c.pausedUntil && c.pausedUntil > new Date() ? c.pausedUntil.toISOString() : null,
  lastError: c.lastError,
  lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
})

function secret() {
  if (!env.CONNECTOR_SECRET) throw new Error("Connecting accounts isn't switched on yet")
  return env.CONNECTOR_SECRET
}

/** The session inside a connection (server only). */
export const secretOf = (c: Connection) => openWith(secret(), c.secretEnc, boundOf(c))

/** Saves a connection; someone has one account of their own per platform, so it replaces any other. */
export async function saveConnection(input: {
  userId: string
  platform: SocialPlatform
  mode?: Connection["mode"]
  accountId: string
  handle: string | null
  name: string | null
  image: string | null
  session: string
  tz?: string | null
}): Promise<Connection> {
  const mode = input.mode ?? "own"
  const secretEnc = sealWith(secret(), input.session, boundOf(input))
  return db.transaction(async (tx) => {
    if (mode === "own")
      await tx
        .delete(schema.connectorSessions)
        .where(
          and(
            eq(schema.connectorSessions.userId, input.userId),
            eq(schema.connectorSessions.platform, input.platform),
            eq(schema.connectorSessions.mode, "own"),
            ne(schema.connectorSessions.accountId, input.accountId),
          ),
        )
    const values = {
      userId: input.userId,
      platform: input.platform,
      mode,
      accountId: input.accountId,
      handle: input.handle,
      name: input.name,
      image: input.image,
      secretEnc,
      status: "active" as const,
      tz: input.tz ?? null,
      pausedUntil: null,
      lastError: null,
      updatedAt: new Date(),
    }
    const [row] = await tx
      .insert(schema.connectorSessions)
      .values(values)
      .onConflictDoUpdate({
        target: [
          schema.connectorSessions.userId,
          schema.connectorSessions.platform,
          schema.connectorSessions.accountId,
        ],
        set: values,
      })
      .returning()
    if (!row) throw new Error("Couldn't save the connection")
    return row
  })
}

/** Someone's own connection on a platform, if any. */
export async function connectionOf(
  userId: string,
  platform: SocialPlatform,
): Promise<Connection | null> {
  const [row] = await db
    .select()
    .from(schema.connectorSessions)
    .where(
      and(
        eq(schema.connectorSessions.userId, userId),
        eq(schema.connectorSessions.platform, platform),
        eq(schema.connectorSessions.mode, "own"),
      ),
    )
  return row ?? null
}

export async function connectionsOf(userId: string): Promise<Connection[]> {
  return db
    .select()
    .from(schema.connectorSessions)
    .where(
      and(eq(schema.connectorSessions.userId, userId), eq(schema.connectorSessions.mode, "own")),
    )
}

/** Najimi's own reading accounts on a platform (spare accounts, never anyone's main). */
export async function poolOf(platform: SocialPlatform): Promise<Connection[]> {
  return db
    .select()
    .from(schema.connectorSessions)
    .where(
      and(
        eq(schema.connectorSessions.platform, platform),
        eq(schema.connectorSessions.mode, "pool"),
        eq(schema.connectorSessions.status, "active"),
      ),
    )
    .orderBy(schema.connectorSessions.lastUsedAt)
}

/** Records how a connection did: used fine, the session changed, or the platform refused it. */
export async function noteConnection(
  c: Connection,
  outcome:
    | { ok: true; session?: string }
    | { ok: false; status?: Connection["status"]; error: string },
) {
  await db
    .update(schema.connectorSessions)
    .set(
      outcome.ok
        ? {
            lastUsedAt: new Date(),
            lastError: null,
            status: "active",
            ...(outcome.session
              ? { secretEnc: sealWith(secret(), outcome.session, boundOf(c)) }
              : {}),
          }
        : {
            lastError: outcome.error.slice(0, 300),
            ...(outcome.status ? { status: outcome.status } : {}),
            updatedAt: new Date(),
          },
    )
    .where(eq(schema.connectorSessions.id, c.id))
}

/** Switches a connection's agents (follow, like, post) and pauses or resumes them. */
export async function setAgents(
  userId: string,
  platform: SocialPlatform,
  change: {
    autopilot?: boolean
    likes?: boolean
    posts?: Connection["posts"]
    pausedUntil?: Date | null
  },
  tz?: string | null,
) {
  const [row] = await db
    .update(schema.connectorSessions)
    .set({ ...change, ...(tz ? { tz } : {}), updatedAt: new Date() })
    .where(
      and(
        eq(schema.connectorSessions.userId, userId),
        eq(schema.connectorSessions.platform, platform),
        eq(schema.connectorSessions.mode, "own"),
      ),
    )
    .returning()
  return row ?? null
}

/** Forgets a connection and its session for good. */
export async function disconnect(userId: string, platform: SocialPlatform) {
  await db
    .delete(schema.connectorSessions)
    .where(
      and(
        eq(schema.connectorSessions.userId, userId),
        eq(schema.connectorSessions.platform, platform),
        eq(schema.connectorSessions.mode, "own"),
      ),
    )
}
