import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"

/** Picks the language (cookie, then Accept-Language) and rewrites to its `[locale]` tree. */
export default createMiddleware(routing)

// API routes and files are never localised.
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] }
