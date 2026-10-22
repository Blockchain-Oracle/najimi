import { GRAPH } from "@najimi/config"
import { explore } from "@najimi/qloo"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

const input = z.object({
  id: z.string().min(8).max(64),
  type: z.string().regex(/^urn:entity:[a-z_]+$/),
  name: z.string().max(200).optional(),
})

/** Grows the graph from one node: what else Qloo ties to it (its own kind, and one other). */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  if (!allow(`graph-expand:${me}`, GRAPH.expandPerMinute, 60_000))
    return fail("Slow down a little", 429)
  const parsed = input.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return fail("Pick a node", 400)
  const { id, type, name } = parsed.data
  const across = GRAPH.across[type as keyof typeof GRAPH.across] ?? "urn:entity:artist"
  const seed = [{ qlooId: id, name: name ?? "", weight: 5 }]
  const ask = (filterType: string) =>
    explore(
      {
        filterType,
        signal: { entities: [{ id, weight: 5 }] },
        filter: { exclude: [id] },
        take: GRAPH.expandTake,
        withImage: true,
      },
      seed,
      { userId: me, purpose: `What Qloo ties to ${name ?? "this"}` },
    ).catch(() => null)
  const [same, other] = await Promise.all([ask(type), ask(across)])
  const picks = [same, other].flatMap((r) => (r?.kind === "entities" ? r.picks : []))
  return json({
    nodes: picks.map((p) => ({
      qlooId: p.qlooId,
      type: p.type,
      name: p.name,
      image: p.image,
      caption: p.caption,
      affinity: p.affinity,
    })),
  })
}
