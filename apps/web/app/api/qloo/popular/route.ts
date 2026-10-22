import { qlooConfigured } from "@najimi/qloo"
import { fail, json } from "@/lib/api"
import { popularLoves } from "@/lib/popular"
import { allow, clientAddress } from "@/lib/rate-limit"

/**
 * The sign-up's "pick 3" grid: well-known things across the domains as Qloo's own entities with
 * artwork. Public (looking at it starts no guest), limited per address.
 */
export async function GET(request: Request) {
  if (!qlooConfigured()) return fail("Qloo isn't connected yet", 503)
  if (!allow(`popular:${clientAddress(request)}`, 30, 60_000))
    return fail("Slow down a little", 429)
  return json({ hits: await popularLoves() })
}
