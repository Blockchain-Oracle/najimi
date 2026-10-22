import { json, withSession } from "@/lib/api"
import { peopleOnEarth } from "@/lib/earth"

/** Everyone public with a city, for the globe's people layer. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  return json({ people: await peopleOnEarth(auth.session.user.id) })
}
