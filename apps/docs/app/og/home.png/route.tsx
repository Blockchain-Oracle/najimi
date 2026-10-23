import { ogImage } from "@/lib/og"
import { SITE } from "@/lib/site"

export const revalidate = false

/** The home page's link preview. */
export function GET() {
  return ogImage({ kicker: "Docs", title: SITE.tagline, description: SITE.description })
}
