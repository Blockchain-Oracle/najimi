import { json, withSession } from "@/lib/api"
import { radarOf } from "@/lib/social"

/** Your taste twins here, and the public people Qloo predicts for your taste. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  return json(await radarOf(auth.session.user.id))
}
