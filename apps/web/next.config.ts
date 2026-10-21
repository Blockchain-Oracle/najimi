import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig: NextConfig = {
  // Self-hosted on Coolify: a minimal server bundle with only the files it needs.
  output: "standalone",
  // Link-preview images read their fonts from disk (lib/og.tsx); the standalone bundle needs them.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**"] },
  // Partial prerendering: static shells paint at once; dynamic parts stream in Suspense.
  cacheComponents: true,
  partialPrefetching: true,
  // typedRoutes stays off: with every page under app/[locale] and no locale in the URL, it can't
  // type the real hrefs ("/", "/start").
  devIndicators: false,
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: [
    "@najimi/agent",
    "@najimi/config",
    "@najimi/db",
    "@najimi/email",
    "@najimi/env",
    "@najimi/jobs",
    "@najimi/live",
    "@najimi/media",
    "@najimi/qloo",
    "@najimi/sources",
    "@najimi/storage",
    "@najimi/tokens",
    "@najimi/ui",
  ],
}

// i18n/request.ts gives every page its language and strings.
export default createNextIntlPlugin()(nextConfig)
