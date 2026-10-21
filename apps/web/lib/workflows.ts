import "server-only"
import { BUILT_IN_WORKFLOWS } from "@najimi/agent/workflows"
import { db, schema } from "@najimi/db"
import { and, desc, eq, isNull, or } from "drizzle-orm"

export type WorkflowRow = typeof schema.workflows.$inferSelect

/** Slugs are lowercase words and digits joined by hyphens (built-ins and saved ones alike). */
export const WORKFLOW_SLUG = /^[a-z0-9-]{3,60}$/

export const isBuiltIn = (w: Pick<WorkflowRow, "ownerId">) => w.ownerId === null

/**
 * A workflow this person may run: a built-in, one someone made public, or their own. Anyone else's
 * private workflow doesn't exist for them.
 */
export async function runnableWorkflow(
  userId: string | null,
  slug: string,
): Promise<WorkflowRow | null> {
  if (!WORKFLOW_SLUG.test(slug)) return null
  const [w] = await db
    .select()
    .from(schema.workflows)
    .where(
      and(
        eq(schema.workflows.slug, slug),
        or(
          isNull(schema.workflows.ownerId),
          eq(schema.workflows.public, true),
          ...(userId ? [eq(schema.workflows.ownerId, userId)] : []),
        ),
      ),
    )
  if (!w) return null
  // A built-in the code no longer has (renamed or retired) isn't runnable.
  if (isBuiltIn(w) && !BUILT_IN_WORKFLOWS.some((b) => b.slug === w.slug)) return null
  return w
}

export const ownWorkflows = (userId: string) =>
  db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.ownerId, userId))
    .orderBy(desc(schema.workflows.createdAt))

/** A saved workflow's slug: its name in plain letters, plus a few random ones so it's unique. */
export function slugFor(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const tail = crypto.randomUUID().replace(/-/g, "").slice(0, 6)
  return `${base.length >= 3 ? base : "workflow"}-${tail}`
}
