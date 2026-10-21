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

    /** The agent model as `provider:model` (`openai:gpt-6-astra`, `anthropic:claude-opus-5-5`). */
    AGENT_MODEL: z
      .string()
      .regex(/^(openai|anthropic):[\w.-]+$/)
      .optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    /** Signs tool approvals so a client can't forge "approved" (same value on every instance). */
    TOOL_APPROVAL_SECRET: z.string().min(32).optional(),
    /** fal.ai, for video (and image models once funded). */
    FAL_KEY: z.string().min(1).optional(),
    /** ElevenLabs Scribe, for voice dictation. */
    ELEVENLABS_API_KEY: z.string().min(1).optional(),
    /** Resend, for sign-in codes. */
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).optional(),

    /** Object storage (RustFS). Server-side only: browsers never talk to it directly. */
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),

    /** Lets the deployed app's live pipe be checked from outside (S00); unset = dev only. */
    SYSTEM_CHECK_TOKEN: z.string().min(16).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
})
