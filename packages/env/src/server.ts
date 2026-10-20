import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/**
 * Server-only environment, shared by the web app and the worker.
 * Validated once at import; a missing or malformed value fails fast with its name.
 * Set SKIP_ENV_VALIDATION=1 only for builds that never run (CI, Docker image builds).
 * Keys for later stages are optional: the feature that needs one says so until it's set.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z.url(),

    BETTER_AUTH_SECRET: z.string().min(32),
    /** The app's public origin (also the base for links in emails and pages). */
    BETTER_AUTH_URL: z.url(),
    /** Google sign-in is offered only when both are set; guests work without it. */
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    /** Qloo hackathon key: server-side only, never in a bundle, repo or recording. */
    QLOO_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    /** Overrides the Claude API address (a proxy); never read from the shell's ANTHROPIC_BASE_URL. */
    NAJIMI_CLAUDE_BASE_URL: z.url().optional(),
    FIRECRAWL_API_KEY: z.string().min(1).optional(),

    /** Lets the deployed app's live pipe be checked from outside (S00); unset = dev only. */
    SYSTEM_CHECK_TOKEN: z.string().min(16).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
})
