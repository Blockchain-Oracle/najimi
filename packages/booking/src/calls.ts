import { createHmac, timingSafeEqual } from "node:crypto"
import { CALLS } from "@najimi/config"
import { env } from "@najimi/env/server"

/*
 * Booking a table by phone (W18): most restaurants and bars have no booking API, so Najimi calls
 * them. An ElevenLabs voice agent places the call over the Twilio number, says up front that it's
 * an AI calling on someone's behalf and that the call is recorded (ElevenLabs' terms), asks for
 * the table, and its post-call analysis says whether it's booked. Only within calling hours, and
 * only after the person approves the script.
 */

const BASE = "https://api.elevenlabs.io"

/*
 * What ElevenLabs sends back to us is signed with our own secret: a short token per call, put in
 * the call's variables, that its tools send as a header (so a tool can only touch that call's
 * booking or that person's chat), and a fixed key on the inbound caller lookup.
 */
const sign = (text: string) =>
  createHmac("sha256", env.ELEVENLABS_TOOL_SECRET ?? "")
    .update(text)
    .digest("base64url")

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export type ToolToken =
  | { kind: "booking"; bookingId: string }
  | { kind: "phone"; userId: string; chatId: string }

/** A token for one call's tools, good for `seconds`; null when the secret isn't set. */
export function toolToken(token: ToolToken, seconds: number): string | null {
  if (!env.ELEVENLABS_TOOL_SECRET) return null
  const body = Buffer.from(JSON.stringify({ ...token, exp: Date.now() + seconds * 1000 })).toString(
    "base64url",
  )
  return `${body}.${sign(`tool:${body}`)}`
}

export function readToolToken<K extends ToolToken["kind"]>(
  kind: K,
  token: string | null,
): Extract<ToolToken, { kind: K }> | null {
  if (!env.ELEVENLABS_TOOL_SECRET || !token) return null
  const [body, mac] = token.split(".")
  if (!body || !mac || !same(mac, sign(`tool:${body}`))) return null
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as {
    kind: string
    exp: number
  }
  if (data.kind !== kind || data.exp < Date.now()) return null
  return data as unknown as Extract<ToolToken, { kind: K }>
}

/** The key the inbound caller lookup carries. */
export const inboundKey = () => (env.ELEVENLABS_TOOL_SECRET ? sign("inbound") : null)

export function isInbound(key: string | null) {
  const want = inboundKey()
  return Boolean(want && key && same(key, want))
}

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
          // Lets the caller tell the chat what's happening ("they're checking the book").
          update_token:
            toolToken({ kind: "booking", bookingId: brief.bookingId }, 15 * 60) ?? "none",
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
const callerOf = (tools: { update: string }) => ({
  name: "Najimi table booking",
  conversation_config: {
    agent: {
      first_message:
        "Hello, I'm Najimi, an AI assistant calling on behalf of {{guest_name}}. This call is recorded. I'd like to book a table for {{party_size}} on {{when}}.",
      language: "en",
      dynamic_variables: {
        dynamic_variable_placeholders: {
          booking_id: "none",
          venue: "the venue",
          guest_name: "a guest",
          party_size: 2,
          when: "tonight",
          notes: "none",
          callback: "none",
          update_token: "none",
        },
      },
      prompt: {
        prompt: [
          "You are Najimi, a polite AI assistant phoning {{venue}} to book a table for {{guest_name}}: {{party_size}} people, {{when}}. Extra requests: {{notes}}. Callback number if they ask: {{callback}}.",
          "Speak in short sentences, one thing at a time, and never repeat what's already been agreed.",
          "Confirm the date, time, party size and the name the table is under once, in one sentence, when they agree. If they ask for any of it again, say it once more plainly.",
          "If that time isn't possible, ask for the nearest time they can do and note it, without accepting it.",
          "Never pay, never share card details, never agree to a deposit; say the guest will confirm.",
          "If an automated menu answers, use the keypad tool to reach a person or reservations.",
          "When they put you on hold or go to check something (the book, a manager), tell the guest with post_update in a few words, at most twice in the call.",
          "If you reach voicemail, leave no message and end the call.",
          "As soon as the booking is settled (booked, or not possible), thank them in one short sentence and end the call with the end_call tool. If they say goodbye, ask you to hang up, or the call is clearly over, say a short goodbye and end the call straight away.",
          "If they ask not to be called by an AI again, apologise, say it won't happen again, and end the call.",
        ].join(" "),
        temperature: 0.2,
        tool_ids: [tools.update],
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
})

/**
 * Najimi on a phone call someone is already on: they dial Najimi's number and merge it in. It's
 * told who they are by our lookup as the call connects (unknown and unconfirmed numbers are told so
 * and it hangs up), says it's an AI and that it's listening, keeps quiet (skip_turn) unless named,
 * and answers through Najimi's own turn in their chat. Nothing on this call spends anything.
 */
const listenerOf = (tools: { ask: string }, lookup: { url: string; key: string }) => ({
  name: "Najimi on your call",
  conversation_config: {
    agent: {
      first_message: "Hi, I'm Najimi, an AI. I'm listening; say my name when you want me.",
      language: "en",
      dynamic_variables: {
        dynamic_variable_placeholders: { user_name: "there", known: "no", ask_token: "none" },
      },
      prompt: {
        prompt: [
          "You are Najimi, an AI that {{user_name}} added to a phone call they're on. Other people may be on the call, talking to each other, not to you.",
          "If {{known}} is not yes, say nothing after your first message and end the call with end_call.",
          "Most of what you hear is people talking to each other, not to you. Unless what was just said contains the word Najimi (or a word that sounds like it), call skip_turn and say nothing at all: no reply, no filler, never 'I'm here' or 'let me know'.",
          "When someone says Najimi and asks something, say 'One sec' and call ask_najimi with what they asked, in their words, including any who, where or when they said. Then say its answer in one or two short sentences and stop; the details are in {{user_name}}'s Najimi chat.",
          "If ask_najimi fails, say only: I couldn't look that up just now. Never say something is in the chat unless ask_najimi answered.",
          "Never book, pay, call anyone, post or promise anything on this call; if they want that, say Najimi can do it from their chat once they say yes there.",
          "If someone asks you to leave or hang up, say a short goodbye and end the call.",
        ].join(" "),
        llm: CALLS.phoneLlm,
        temperature: 0.2,
        tool_ids: [tools.ask],
        built_in_tools: { end_call: system("end_call"), skip_turn: system("skip_turn") },
      },
    },
    conversation: { max_duration_seconds: CALLS.phoneMaxSeconds },
    // Several people talking: it waits for a clear end of turn before it even considers speaking.
    turn: { turn_eagerness: "patient" },
  },
  platform_settings: {
    overrides: {
      enable_conversation_initiation_client_data_from_webhook: true,
      conversation_config_override: { agent: { first_message: true } },
    },
    workspace_overrides: {
      conversation_initiation_client_data_webhook: {
        url: lookup.url,
        request_headers: { "x-najimi-key": lookup.key },
      },
    },
  },
})

type Tool = { id: string; tool_config: { name: string } }

/** The tools ElevenLabs calls back on: asking Najimi (phone calls) and a venue call's updates. */
const toolsOf = (site: string) => [
  {
    type: "webhook",
    name: "ask_najimi",
    description:
      "Ask Najimi (with the taste of everyone involved, from Qloo) what someone on the call asked you. Returns the answer to say.",
    response_timeout_secs: 60,
    api_schema: {
      url: `${site}/api/webhooks/elevenlabs/ask`,
      method: "POST",
      request_body_schema: {
        type: "object",
        description: "The question asked",
        required: ["question"],
        properties: {
          question: {
            type: "string",
            description: "What they asked, in their words, with any who, where or when they said",
          },
        },
      },
      request_headers: { "x-najimi-token": { variable_name: "ask_token" } },
    },
  },
  {
    type: "webhook",
    name: "post_update",
    description:
      "Tell the guest what's happening on the call right now, in a few words (for example: they're checking the book).",
    response_timeout_secs: 10,
    api_schema: {
      url: `${site}/api/webhooks/elevenlabs/update`,
      method: "POST",
      request_body_schema: {
        type: "object",
        description: "The update",
        required: ["text"],
        properties: {
          text: { type: "string", description: "A few words, like: They're checking the book" },
        },
      },
      request_headers: { "x-najimi-token": { variable_name: "update_token" } },
    },
  },
]

/** Makes or updates each tool by name, and returns their ids. */
async function syncTools(site: string) {
  const { tools } = await el<{ tools: Tool[] }>("/v1/convai/tools")
  const ids: Record<string, string> = {}
  for (const config of toolsOf(site)) {
    const have = tools.find((t) => t.tool_config.name === config.name)
    const saved = have
      ? await el<Tool>(`/v1/convai/tools/${have.id}`, {
          method: "PATCH",
          body: { tool_config: config },
        })
      : await el<Tool>("/v1/convai/tools", { body: { tool_config: config } })
    ids[config.name] = saved.id
  }
  return { ask: ids.ask_najimi as string, update: ids.post_update as string }
}

/**
 * Brings Najimi's phone agents up to date at ElevenLabs: the tools, the table-booking caller, and
 * the listener that answers Najimi's number (made the first time, then kept up to date by name).
 * `site` is where ElevenLabs reaches us (the live app).
 */
export async function syncPhoneAgents(site: string) {
  if (!env.ELEVENLABS_CALLER_AGENT_ID || !env.ELEVENLABS_PHONE_NUMBER_ID)
    throw new Error("The caller and Najimi's number come first")
  const key = inboundKey()
  if (!key) throw new Error("ELEVENLABS_TOOL_SECRET isn't set")
  const tools = await syncTools(site)
  await el(`/v1/convai/agents/${env.ELEVENLABS_CALLER_AGENT_ID}`, {
    method: "PATCH",
    body: callerOf(tools),
  })
  const listener = listenerOf(tools, { url: `${site}/api/webhooks/elevenlabs/inbound`, key })
  const { agents } = await el<{ agents: { agent_id: string; name: string }[] }>(
    "/v1/convai/agents?page_size=100",
  )
  const have = agents.find((a) => a.name === listener.name)
  const agentId = have
    ? (
        await el<{ agent_id: string }>(`/v1/convai/agents/${have.agent_id}`, {
          method: "PATCH",
          body: listener,
        })
      ).agent_id
    : (await el<{ agent_id: string }>("/v1/convai/agents/create", { body: listener })).agent_id
  // Calls to Najimi's number reach the listener; calls out name their own agent.
  await el(`/v1/convai/phone-numbers/${env.ELEVENLABS_PHONE_NUMBER_ID}`, {
    method: "PATCH",
    body: { agent_id: agentId },
  })
  return { tools, listener: agentId }
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
