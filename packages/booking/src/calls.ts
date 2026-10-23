import { env } from "@najimi/env/server"

/*
 * Booking a table by phone (W18): most restaurants and bars have no booking API, so Najimi calls
 * them. An ElevenLabs voice agent places the call over the Twilio number, says up front that it's
 * an AI calling on someone's behalf and that the call is recorded (ElevenLabs' terms), asks for
 * the table, and its post-call analysis says whether it's booked. Only within calling hours, and
 * only after the person approves the script.
 */

const BASE = "https://api.elevenlabs.io"

/** Calls go out between these local hours (TCPA's 8am–9pm, kept everywhere). */
export const CALL_HOURS = { from: 8, to: 21 } as const

/**
 * Where a venue's number rings, for calling hours in its own time: countries with one time zone,
 * by calling code (longest first). Others (the US, Canada, Brazil, Australia…) fall back to the
 * person's own zone.
 */
const ZONES: [string, string][] = [
  ["+234", "Africa/Lagos"],
  ["+233", "Africa/Accra"],
  ["+254", "Africa/Nairobi"],
  ["+255", "Africa/Dar_es_Salaam"],
  ["+256", "Africa/Kampala"],
  ["+27", "Africa/Johannesburg"],
  ["+20", "Africa/Cairo"],
  ["+212", "Africa/Casablanca"],
  ["+221", "Africa/Dakar"],
  ["+225", "Africa/Abidjan"],
  ["+250", "Africa/Kigali"],
  ["+44", "Europe/London"],
  ["+353", "Europe/Dublin"],
  ["+33", "Europe/Paris"],
  ["+49", "Europe/Berlin"],
  ["+34", "Europe/Madrid"],
  ["+39", "Europe/Rome"],
  ["+31", "Europe/Amsterdam"],
  ["+351", "Europe/Lisbon"],
  ["+971", "Asia/Dubai"],
  ["+966", "Asia/Riyadh"],
  ["+91", "Asia/Kolkata"],
  ["+81", "Asia/Tokyo"],
  ["+65", "Asia/Singapore"],
]

export function venueZone(phone: string): string | null {
  return ZONES.find(([code]) => phone.startsWith(code))?.[1] ?? null
}

export const callsOn = () =>
  Boolean(
    env.ELEVENLABS_API_KEY && env.ELEVENLABS_CALLER_AGENT_ID && env.ELEVENLABS_PHONE_NUMBER_ID,
  )

async function el<T>(path: string, init: { method?: string; body?: unknown } = {}) {
  if (!env.ELEVENLABS_API_KEY) throw new Error("Calling isn't connected yet")
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(30_000),
  })
  const body = (await res.json().catch(() => null)) as (T & { detail?: unknown }) | null
  if (!res.ok || !body) throw new Error(`ElevenLabs answered ${res.status}`)
  return body
}

/** What the caller says and asks, filled per call (the agent's prompt reads these variables). */
export type CallBrief = {
  bookingId: string
  venue: string
  /** The person the table is for. */
  guestName: string
  party: number
  /** "Saturday 24 October at 9pm", in the venue's words. */
  when: string
  /** Anything to ask for (outdoor, quiet corner, birthday). */
  notes: string | null
  /** A callback number for the venue, if the person gave one. */
  callback: string | null
}

/** The words the caller opens with: who it is, that it's an AI, that it's recorded. */
export const openingOf = (b: CallBrief) =>
  `Hello, is this ${b.venue}? I'm Najimi, an AI assistant calling on behalf of ${b.guestName}. This call is recorded. I'd like to book a table for ${b.party} on ${b.when}.`

/** Places the call. Results arrive by the post-call webhook (or by fetching the conversation). */
export async function placeCall(to: string, brief: CallBrief) {
  if (!callsOn()) throw new Error("Calling isn't connected yet")
  const body = await el<{
    success: boolean
    message?: string
    conversation_id?: string | null
    callSid?: string | null
  }>("/v1/convai/twilio/outbound-call", {
    body: {
      agent_id: env.ELEVENLABS_CALLER_AGENT_ID,
      agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID,
      to_number: to,
      conversation_initiation_client_data: {
        dynamic_variables: {
          booking_id: brief.bookingId,
          venue: brief.venue,
          guest_name: brief.guestName,
          party_size: brief.party,
          when: brief.when,
          notes: brief.notes ?? "none",
          callback: brief.callback ?? "none",
        },
        conversation_config_override: { agent: { first_message: openingOf(brief) } },
      },
      call_recording_enabled: true,
      telephony_call_config: { ringing_timeout_secs: 45 },
    },
  })
  if (!body.success) throw new Error(body.message ?? "The call didn't go through")
  return { conversationId: body.conversation_id ?? null, callSid: body.callSid ?? null }
}

export type CallResult = {
  status: "initiated" | "in-progress" | "processing" | "done" | "failed"
  booked: boolean | null
  /** What the venue said, in a line or two. */
  summary: string | null
  confirmation: string | null
  /** A time the venue offered instead, if they couldn't do the one asked. */
  offered: string | null
  /** It reached a voicemail, not a person. */
  voicemail: boolean
  /** The venue asked not to be called by an AI again. */
  doNotCall: boolean
  seconds: number | null
}

type Conversation = {
  status: CallResult["status"]
  metadata?: { call_duration_secs?: number }
  analysis?: {
    call_successful?: "success" | "failure" | "unknown"
    transcript_summary?: string
    data_collection_results?: Record<string, { value?: unknown }>
  }
}

export const resultOf = (c: Conversation): CallResult => {
  const data = c.analysis?.data_collection_results ?? {}
  const value = (k: string) => {
    const v = data[k]?.value
    return v == null || v === "" ? null : v
  }
  const booked = value("booking_confirmed")
  return {
    status: c.status,
    booked:
      typeof booked === "boolean"
        ? booked
        : c.analysis?.call_successful === "success"
          ? true
          : null,
    summary: c.analysis?.transcript_summary ?? null,
    confirmation: (value("confirmation_name") as string | null) ?? null,
    offered: (value("alternative_time") as string | null) ?? null,
    voicemail: value("reached_voicemail") === true,
    doNotCall: value("do_not_call") === true,
    seconds: c.metadata?.call_duration_secs ?? null,
  }
}

/** A call's outcome, fetched (when the webhook hasn't come). */
export async function callResult(conversationId: string): Promise<CallResult> {
  return resultOf(
    await el<Conversation>(`/v1/convai/conversations/${encodeURIComponent(conversationId)}`),
  )
}

/** ElevenLabs' own system tools, switched on by name. */
const system = (name: string, params: Record<string, unknown> = {}) => ({
  type: "system",
  name,
  description: "",
  params: { system_tool_type: name, ...params },
})

/**
 * Everything the caller is, in one place, for making it and for keeping it up to date: its brief
 * (brief turns, confirm once, hang up when it's settled or when asked), the disclosure, the tools
 * it may use (hang up, leave voicemail without a message, press keys through a phone menu), and
 * the facts its analysis pulls from every call.
 */
const CALLER = {
  name: "Najimi table booking",
  conversation_config: {
    agent: {
      first_message:
        "Hello, I'm Najimi, an AI assistant calling on behalf of {{guest_name}}. This call is recorded. I'd like to book a table for {{party_size}} on {{when}}.",
      language: "en",
      prompt: {
        prompt: [
          "You are Najimi, a polite AI assistant phoning {{venue}} to book a table for {{guest_name}}: {{party_size}} people, {{when}}. Extra requests: {{notes}}. Callback number if they ask: {{callback}}.",
          "Speak in short sentences, one thing at a time, and never repeat what's already been agreed.",
          "Confirm the date, time, party size and the name the table is under once, in one sentence, when they agree. If they ask for any of it again, say it once more plainly.",
          "If that time isn't possible, ask for the nearest time they can do and note it, without accepting it.",
          "Never pay, never share card details, never agree to a deposit; say the guest will confirm.",
          "If an automated menu answers, use the keypad tool to reach a person or reservations.",
          "If you reach voicemail, leave no message and end the call.",
          "As soon as the booking is settled (booked, or not possible), thank them in one short sentence and end the call with the end_call tool. If they say goodbye, ask you to hang up, or the call is clearly over, say a short goodbye and end the call straight away.",
          "If they ask not to be called by an AI again, apologise, say it won't happen again, and end the call.",
        ].join(" "),
        temperature: 0.2,
        built_in_tools: {
          end_call: system("end_call"),
          voicemail_detection: system("voicemail_detection", { voicemail_message: "" }),
          play_keypad_touch_tone: system("play_keypad_touch_tone"),
        },
      },
    },
    conversation: { max_duration_seconds: 240 },
    // Twenty seconds of silence and it hangs up, rather than holding a dead line.
    turn: { silence_end_call_timeout: 20 },
  },
  platform_settings: {
    data_collection: {
      booking_confirmed: {
        type: "boolean",
        description: "Did the venue confirm the table at the time asked?",
      },
      confirmation_name: {
        type: "string",
        description: "The name the table is under, as the venue said it.",
      },
      alternative_time: {
        type: "string",
        description: "A different time the venue offered, if any.",
      },
      reached_voicemail: {
        type: "boolean",
        description: "Did the call reach a voicemail or answering machine instead of a person?",
      },
      do_not_call: {
        type: "boolean",
        description: "Did the venue ask not to be called by an AI again?",
      },
    },
    overrides: { conversation_config_override: { agent: { first_message: true } } },
  },
}

/** The caller itself, made once (ElevenLabs keeps it). */
export async function createCaller() {
  return el<{ agent_id: string }>("/v1/convai/agents/create", { body: CALLER })
}

/** Brings the caller ElevenLabs keeps up to date with the definition above. */
export async function updateCaller() {
  if (!env.ELEVENLABS_CALLER_AGENT_ID) throw new Error("There's no caller to update yet")
  return el<{ agent_id: string }>(`/v1/convai/agents/${env.ELEVENLABS_CALLER_AGENT_ID}`, {
    method: "PATCH",
    body: CALLER,
  })
}

/** Connects Najimi's Twilio number to ElevenLabs once, for outbound calls. */
export async function connectNumber() {
  if (!env.TWILIO_PHONE_NUMBER || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN)
    throw new Error("Twilio isn't connected")
  return el<{ phone_number_id: string }>("/v1/convai/phone-numbers", {
    body: {
      phone_number: env.TWILIO_PHONE_NUMBER,
      label: "Najimi",
      provider: "twilio",
      sid: env.TWILIO_ACCOUNT_SID,
      token: env.TWILIO_AUTH_TOKEN,
    },
  })
}
