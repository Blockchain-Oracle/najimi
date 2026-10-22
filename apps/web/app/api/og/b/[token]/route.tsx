import { sharedBusiness } from "@/lib/business"
import { ogCard } from "@/lib/og"

/** A shared business plan's link preview: the business, its kind and city, its people's words and loves. */
export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const b = await sharedBusiness((await ctx.params).token)
  if (!b?.report) return new Response("Not found", { status: 404 })
  // One from each kind first (an artist, a brand, a place…), so the card reads as a mix.
  const kinds = Object.values(b.report.fans)
  const fans = [...kinds.map((k) => k[0]), ...kinds.flatMap((k) => k.slice(1))].filter(
    (f): f is NonNullable<typeof f> => Boolean(f?.image),
  )
  return ogCard({
    title: b.name,
    line: [b.kind, b.city].filter(Boolean).join(" · "),
    chips: b.report.words.slice(0, 5).map((w) => w.name),
    images: fans.map((f) => f.image),
  })
}
