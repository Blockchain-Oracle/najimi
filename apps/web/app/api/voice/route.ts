import { LOCALES } from "@najimi/config"
import { env } from "@najimi/env/server"
import { fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

const MAX_BYTES = 6 * 1024 * 1024
const HOUR_MS = 60 * 60 * 1000

/**
 * Voice dictation (T5): a short recording becomes words in the composer (ElevenLabs Scribe v2),
 * never sent on its own. The language hint is the person's language when Scribe supports it well;
 * for the beta languages it detects the language itself.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!env.ELEVENLABS_API_KEY) return fail("Voice isn't set up on this server", 503)
  if (!allow(`voice:${auth.session.user.id}`, 40, HOUR_MS))
    return fail("That's a lot of talking for one hour", 429)
  const form = await request.formData().catch(() => null)
  const audio = form?.get("audio")
  if (!(audio instanceof File) || audio.size === 0) return fail("No recording", 400)
  if (audio.size > MAX_BYTES) return fail("That recording is too long", 413)
  const locale = String(form?.get("locale") ?? "")
  const hint = LOCALES.find((l) => l.code === locale && !l.beta)?.code

  const upstream = new FormData()
  upstream.set("model_id", "scribe_v2")
  upstream.set("file", audio, audio.name || "voice.webm")
  upstream.set("tag_audio_events", "false")
  if (hint) upstream.set("language_code", hint)
  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
    body: upstream,
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null)
  if (!response?.ok) return fail("We couldn't hear that. Try again.", 502)
  const body = (await response.json()) as { text?: string }
  return json({ text: (body.text ?? "").trim() })
}
