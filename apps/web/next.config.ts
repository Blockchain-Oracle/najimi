import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Self-hosted on Coolify: a minimal server bundle with only the files it needs.
  output: "standalone",
  // Partial prerendering: static shells paint at once; dynamic parts stream in Suspense.
  cacheComponents: true,
  typedRoutes: true,
  devIndicators: false,
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: [
    "@najimi/config",
    "@najimi/db",
    "@najimi/env",
    "@najimi/jobs",
    "@najimi/live",
    "@najimi/tokens",
    "@najimi/ui",
  ],
}

export default nextConfig
