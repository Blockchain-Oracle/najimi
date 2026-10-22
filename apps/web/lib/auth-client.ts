import { anonymousClient, emailOTPClient, usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [anonymousClient(), emailOTPClient(), usernameClient()],
})

/** Makes sure there's a session: a guest is started the first time someone does anything. */
export async function ensureSession(): Promise<void> {
  const session = await authClient.getSession()
  if (session.data) return
  const guest = await authClient.signIn.anonymous()
  if (guest.error) throw new Error(guest.error.message ?? "We couldn't start a session")
}
