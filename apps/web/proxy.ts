import { type NextRequest, NextResponse } from "next/server"
import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"

const intl = createMiddleware(routing)

/** The app's one address (najimi.xyz in production, localhost in development). */
const canonical = (() => {
  try {
    return process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : null
  } catch {
    return null
  }
})()

/**
 * Pages answer on the app's own address: www and older hosts move there for good (sign-in
 * cookies, push and links all live on one origin). Then the language (cookie, then
 * Accept-Language) picks the `[locale]` tree.
 */
export default function proxy(request: NextRequest) {
  const host = request.headers.get("host")
  if (canonical && host && host !== canonical.host && !host.startsWith("localhost")) {
    const url = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonical.origin)
    return NextResponse.redirect(url, 308)
  }
  return intl(request)
}

// API routes and files are never localised (or moved: a link preview may come from anywhere).
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] }
