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
    // Taste imports and feed media (each feature hides until its key is set).
    LASTFM_API_KEY: z.string().min(1).optional(),
    TMDB_READ_TOKEN: z.string().min(1).optional(),
    /** ElevenLabs Scribe, for voice dictation. */
    ELEVENLABS_API_KEY: z.string().min(1).optional(),
    // Plans and booking (W16–W18): each one switches its part on when its key is set.
    /** Routes between a plan's stops (Mapbox Directions). */
    MAPBOX_TOKEN: z.string().min(1).optional(),
    /** Shows near a plan (Ticketmaster Discovery). */
    TICKETMASTER_API_KEY: z.string().min(1).optional(),
    JAMBASE_API_KEY: z.string().min(1).optional(),
    /** Hotels, booked for real (Nuitee Connect's live key; Nuitee takes the payment). */
    NUITEE_API_KEY: z.string().min(1).optional(),
    /** Najimi's share on a hotel booking, in percent (Nuitee's `margin`). */
    NUITEE_MARGIN: z.coerce.number().min(0).max(30).default(8),
    /** Calling a venue to book a table: the number Najimi calls from (Twilio, via ElevenLabs). */
    TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    TWILIO_PHONE_NUMBER: z.string().min(1).optional(),
    /** The ElevenLabs voice agent that calls venues, and the Twilio number it calls from (set once). */
    ELEVENLABS_CALLER_AGENT_ID: z.string().min(1).optional(),
    ELEVENLABS_PHONE_NUMBER_ID: z.string().min(1).optional(),
    /** Verifies ElevenLabs' post-call webhook (HMAC). */
    ELEVENLABS_WEBHOOK_SECRET: z.string().min(1).optional(),
    // Social both ways (W14, W15).
    /** Encrypts the sessions people connect (AES-256-GCM); at least 32 characters. */
    CONNECTOR_SECRET: z.string().min(32).optional(),
    /** The internal social bridge (Instagram, TikTok) and the token it answers to. */
    SOCIAL_BRIDGE_URL: z.url().optional(),
    SOCIAL_BRIDGE_TOKEN: z.string().min(24).optional(),
    /** Tours as links out (Viator Basic Access). */
    VIATOR_API_KEY: z.string().min(1).optional(),
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
