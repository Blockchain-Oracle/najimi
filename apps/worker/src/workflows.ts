import { BUILT_IN_WORKFLOWS } from "@najimi/agent"
import { db, schema } from "@najimi/db"

/** Keeps the built-in workflows in the database (by slug), so chats can point at them. */
export async function seedWorkflows(): Promise<void> {
  for (const w of BUILT_IN_WORKFLOWS) {
    await db
      .insert(schema.workflows)
      .values({
        slug: w.slug,
        ownerId: null,
        name: w.slug,
        description: "",
        category: w.category,
        needs: w.needs,
        instructions: w.instructions,
        public: true,
      })
      .onConflictDoUpdate({
        target: schema.workflows.slug,
        set: { instructions: w.instructions, category: w.category, needs: w.needs },
      })
  }
}
