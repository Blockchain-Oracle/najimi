import { icsOf } from "@najimi/booking"
import { fail } from "@/lib/api"
import { planByToken } from "@/lib/plans"

const STOP_MS = 90 * 60_000

/** The plan as a calendar file: one event per stop, at its own time. */
export async function GET(_: Request, ctx: RouteContext<"/api/plans/[token]/ics">) {
  const plan = await planByToken((await ctx.params).token)
  if (!plan) return fail("Unknown plan", 404)
  const events = plan.stops.flatMap((stop, i) => {
    if (!stop.startsAt) return []
    const start = new Date(stop.startsAt)
    return [
      {
        uid: `${plan.token}-${i}`,
        title: `${stop.name}${stop.area ? ` · ${stop.area}` : ""}`,
        start,
        end: new Date(start.getTime() + STOP_MS),
        where: [stop.name, stop.area, plan.city].filter(Boolean).join(", "),
        notes: stop.why,
      },
    ]
  })
  if (!events.length) return fail("This plan has no times yet", 404)
  return new Response(icsOf(events), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="najimi-${plan.token}.ics"`,
    },
  })
}
