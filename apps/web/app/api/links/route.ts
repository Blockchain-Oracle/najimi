import { z } from "zod"
import { body, json, withSession } from "@/lib/api"
import { linksOf, stopLink } from "@/lib/links"

const input = z.object({
  kind: z.enum(["person", "chat", "creation", "wrapped", "plan", "game", "business", "invite"]),
  id: z.string().min(6).max(64),
})

/** Every public link you made (Settings → Your share links). */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  return json({ links: await linksOf(auth.session.user.id) })
}

/** Stops one of them. */
export async function DELETE(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  await stopLink(auth.session.user.id, parsed.data.kind, parsed.data.id)
  return json({ ok: true })
}
