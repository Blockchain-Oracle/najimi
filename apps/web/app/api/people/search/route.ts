import { json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"
import { findPeople } from "@/lib/social"

/** People by @username or name (private profiles never show). */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!allow(`people-search:${auth.session.user.id}`, 60, 60_000)) return json({ people: [] })
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 40) ?? ""
  return json({ people: await findPeople(q, auth.session.user.id) })
}
