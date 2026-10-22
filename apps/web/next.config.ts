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
  // Qloo's artwork through the image optimiser: small, cached and same-origin (images.qloo.com
  // refuses requests that carry an Origin, so a canvas couldn't load it straight and still be saved).
  images: { remotePatterns: [{ protocol: "https", hostname: "images.qloo.com" }] },
  // The service worker is always fetched fresh (a stale one would hold old push handling).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
  // Local only: 127.0.0.1 is a second origin (no cookies), to walk sign-up as a stranger.
  allowedDevOrigins: ["127.0.0.1"],
  // X's client stays a plain Node dependency (axios, linkedom) rather than being bundled.
  serverExternalPackages: ["rettiwt-api"],
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: [
    "@najimi/agent",
    "@najimi/booking",
    "@najimi/config",
    "@najimi/db",
    "@najimi/email",
    "@najimi/games",
    "@najimi/geo",
    "@najimi/env",
    "@najimi/jobs",
    "@najimi/live",
    "@najimi/media",
    "@najimi/qloo",
    "@najimi/sources",
    "@najimi/connectors",
    "@najimi/storage",
    "@najimi/tokens",
    "@najimi/ui",
  ],
}

// i18n/request.ts gives every page its language and strings.
export default createNextIntlPlugin()(nextConfig)
