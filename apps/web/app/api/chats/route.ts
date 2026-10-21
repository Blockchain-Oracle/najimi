import { json, withSession } from "@/lib/api"
import { chatsOf } from "@/lib/chat/store"

/** The chats list (sidebar), newest first; `q` searches titles. */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) || undefined
  return json({ chats: await chatsOf(auth.session.user.id, { q }) })
}
