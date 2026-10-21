import "server-only"
import { ALLOWANCE, APP, AUTH, EMAIL } from "@najimi/config"
import { db } from "@najimi/db"
import { reownUserData } from "@najimi/db/owned"
import * as schema from "@najimi/db/schema"
import { codeEmail, emailReady, sendEmail } from "@najimi/email"
import { env } from "@najimi/env/server"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { anonymous, emailOTP } from "better-auth/plugins"
import { allow } from "@/lib/rate-limit"

/** Google sign-in is offered only when its keys are set; guests and email codes always work. */
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
export const emailEnabled = emailReady()

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const addressOf = (headers: Headers | undefined) =>
  headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || headers?.get("x-real-ip") || "local"

/**
 * Checks that must reach the person (Better Auth swallows errors thrown while sending): guests are
 * capped per network address per hour, and codes are for signing in, never to a guest address,
 * within a daily cap per address.
 */
const before = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/sign-in/anonymous") {
    if (!allow(`guest:${addressOf(ctx.headers)}`, ALLOWANCE.guestsPerIpPerHour, HOUR_MS))
      throw new APIError("TOO_MANY_REQUESTS", {
        message: "Too many new guests from here. Sign in instead.",
      })
    return
  }
  if (ctx.path !== "/email-otp/send-verification-otp") return
  const body = (ctx.body ?? {}) as { email?: unknown; type?: unknown }
  if (body.type !== "sign-in") throw new APIError("BAD_REQUEST", { message: "Not available" })
  if (!emailReady())
    throw new APIError("SERVICE_UNAVAILABLE", { message: "Email isn't set up on this server" })
  if (
    String(body.email ?? "")
      .toLowerCase()
      .endsWith(`@${AUTH.guestEmailDomain}`)
  )
    throw new APIError("BAD_REQUEST", { message: "That's a guest address, not an email" })
  if (!allow(`code:${addressOf(ctx.headers)}`, 12, DAY_MS))
    throw new APIError("TOO_MANY_REQUESTS", { message: "That's all the codes for today." })
})

export const auth = betterAuth({
  appName: APP.name,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID ?? "",
          clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
          prompt: "select_account",
        },
      }
    : {},
  session: {
    expiresIn: AUTH.sessionExpiresInSeconds,
    updateAge: AUTH.sessionUpdateAgeSeconds,
  },
  telemetry: { enabled: false },
  hooks: { before },
  plugins: [
    anonymous({
      emailDomainName: AUTH.guestEmailDomain,
      // A guest who signs in keeps everything: rows move to the signed-in user (including into an
      // account that already exists). The plugin's own cleanup is off: Konkyo found it skips
      // first-time social sign-ups; guests.cleanup removes old guests instead.
      disableDeleteAnonymousUser: true,
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await reownUserData(db, anonymousUser.user.id, newUser.user.id)
      },
    }),
    // Six digits by email: sign in, or keep a guest's taste. The anonymous plugin links a guest
    // who signs in this way, like Google (onLinkAccount above).
    emailOTP({
      otpLength: EMAIL.codeLength,
      expiresIn: EMAIL.codeExpiresInSeconds,
      allowedAttempts: EMAIL.codeAttempts,
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "sign-in") return
        // Not awaited: the reply mustn't reveal how long sending took.
        void sendEmail({ to: email, ...codeEmail(otp) }).catch((error) =>
          console.error("[email] code", (error as Error).message),
        )
      },
    }),
    nextCookies(), // must stay last
  ],
})

export type Session = typeof auth.$Infer.Session
