import "server-only"
import type { Player } from "@najimi/games/round"
import { cookies } from "next/headers"
import { getSession } from "@/lib/session"

const GUEST = "najimi_player"

/**
 * Who's playing: the signed-in person, or a guest from a challenge link (a random key in a cookie,
 * so their answers stay theirs without an account).
 */
export async function currentPlayer(create = false): Promise<Player | null> {
  const session = await getSession()
  if (session) return { userId: session.user.id }
  const jar = await cookies()
  const key = jar.get(GUEST)?.value
  if (key && /^[a-z0-9]{16,40}$/.test(key)) return { guestKey: key }
  if (!create) return null
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(36).padStart(2, "0"),
  )
    .join("")
    .slice(0, 24)
  jar.set(GUEST, fresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
  return { guestKey: fresh }
}
