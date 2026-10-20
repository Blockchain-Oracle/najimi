import "server-only"
import { APP, AUTH } from "@najimi/config"
import { db } from "@najimi/db"
import { reownUserData } from "@najimi/db/owned"
import * as schema from "@najimi/db/schema"
import { env } from "@najimi/env/server"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { anonymous } from "better-auth/plugins"

/** Google sign-in is offered only when its keys are set; guests always work. */
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)

export const auth = betterAuth({
  appName: APP.name,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            prompt: "select_account",
          },
        }
      : {},
  session: {
    expiresIn: AUTH.sessionExpiresInSeconds,
    updateAge: AUTH.sessionUpdateAgeSeconds,
  },
  telemetry: { enabled: false },
  plugins: [
    anonymous({
      emailDomainName: AUTH.guestEmailDomain,
      // A guest who signs in keeps every business and run: rows move to the new user, then the
      // guest is deleted. The plugin's own cleanup is off (Konkyo found it skips first sign-ups).
      disableDeleteAnonymousUser: true,
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await reownUserData(db, anonymousUser.user.id, newUser.user.id)
      },
    }),
    nextCookies(), // must stay last
  ],
})

export type Session = typeof auth.$Infer.Session
