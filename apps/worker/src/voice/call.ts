import type { AudioSource, Participant, RemoteParticipant, RemoteTrack } from "@livekit/rtc-node"
import { agentModel, lightModelId } from "@najimi/agent"
import { addLine, askAloud, endCall } from "@najimi/agent/server"
import { CALLS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { CallLine } from "@najimi/db/schema"
import { env } from "@najimi/env/server"
import type { Payload } from "@najimi/jobs"
import { generateText } from "ai"
import { eq } from "drizzle-orm"
import { AccessToken } from "livekit-server-sdk"

/*
 * Najimi in a call (W22). It joins the room as a participant of its own, hears each member
 * separately (LiveKit's active-speaker signal marks when each one starts and stops, and each
 * utterance is transcribed on its own, so it always knows who said what), and keeps the
 * transcript. It answers only when someone says its name: what they asked goes into the chat as
 * their message, Najimi's usual turn answers it there (cards and all), and the first line or two
 * of that answer is spoken back. When everyone has left it writes a short summary on the call's
 * card and leaves.
 */

/** LiveKit's native module, loaded on the first call: a missing binary stops calls, not the worker. */
let rtc: typeof import("@livekit/rtc-node") | null = null
const livekit = async () => {
  rtc ??= await import("@livekit/rtc-node")
  return rtc
}

const HEAR_RATE = 16_000
const SPEAK_RATE = 24_000
/** 10 ms of audio at the speaking rate. */
const SPEAK_FRAME = SPEAK_RATE / 100
/**
 * How "Najimi" comes back from speech-to-text: as itself and its near spellings (Najimy, Nagimi,
 * Nijimi), and as the name it's most often heard as, "(Na) Jimmy" (seen in real calls).
 */
const ADDRESSED =
  /\bn[aeio]\s?(?:j|g|dz|zh|y)\s?(?:i|ee|e|a)?\s?m(?:i|ee|y|e)\b|\b(?:na[\s-]?)?jimm?(?:y|ie|i)\b/i
/** Tells speech-to-text the name it will hear, so it spells it right more often. */
const HEARING_HINT = "A voice call with Najimi, an AI. People say its name: Najimi."

type Speaker = {
  identity: string
  name: string
  /** The last ~300 ms, kept so an utterance's first word isn't lost. */
  pre: Int16Array[]
  frames: Int16Array[] | null
  startedAt: number
  stoppedAt: number | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function wav(samples: Int16Array, rate: number): Blob {
  const header = new DataView(new ArrayBuffer(44))
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) header.setUint8(o + i, s.charCodeAt(i))
  }
  write(0, "RIFF")
  header.setUint32(4, 36 + samples.byteLength, true)
  write(8, "WAVE")
  write(12, "fmt ")
  header.setUint32(16, 16, true)
  header.setUint16(20, 1, true)
  header.setUint16(22, 1, true)
  header.setUint32(24, rate, true)
  header.setUint32(28, rate * 2, true)
  header.setUint16(32, 2, true)
  header.setUint16(34, 16, true)
  write(36, "data")
  header.setUint32(40, samples.byteLength, true)
  return new Blob([header.buffer, samples.buffer as ArrayBuffer], { type: "audio/wav" })
}

const join = (chunks: Int16Array[]) => {
  const out = new Int16Array(chunks.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

async function transcribe(samples: Int16Array): Promise<string> {
  if (!env.OPENAI_API_KEY) return ""
  const form = new FormData()
  form.set("model", CALLS.sttModel)
  form.set("prompt", HEARING_HINT)
  form.set("file", wav(samples, HEAR_RATE), "speech.wav")
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(20_000),
  })
  if (!r.ok) return ""
  const body = (await r.json()) as { text?: string }
  return body.text?.trim() ?? ""
}

/** Speaks a line through the room: ElevenLabs' raw 24 kHz audio, 10 ms at a time. */
async function speak(source: AudioSource, text: string) {
  if (!env.ELEVENLABS_API_KEY || !text.trim()) return
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${CALLS.voiceId}/stream?output_format=pcm_24000`,
    {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: CALLS.ttsModel,
        voice_settings: { speed: CALLS.voiceSpeed },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  )
  if (!r.ok || !r.body) return
  const { AudioFrame } = await livekit()
  let rest = new Uint8Array(0)
  for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) {
    const bytes = new Uint8Array(rest.length + chunk.length)
    bytes.set(rest)
    bytes.set(chunk, rest.length)
    const whole = Math.floor(bytes.length / (SPEAK_FRAME * 2)) * SPEAK_FRAME * 2
    for (let o = 0; o < whole; o += SPEAK_FRAME * 2) {
      const pcm = new Int16Array(bytes.slice(o, o + SPEAK_FRAME * 2).buffer)
      await source.captureFrame(new AudioFrame(pcm, SPEAK_RATE, 1, SPEAK_FRAME))
    }
    rest = bytes.slice(whole)
  }
}

/** A few lines on what the call was about and what was decided, for its card. */
async function summarise(room: string): Promise<string | null> {
  const [call] = await db
    .select({ transcript: schema.calls.transcript })
    .from(schema.calls)
    .where(eq(schema.calls.room, room))
  const lines = (call?.transcript ?? []) as CallLine[]
  if (lines.length < 2) return null
  const read = await generateText({
    model: agentModel(lightModelId()),
    prompt: `This is a voice call between friends, with Najimi (an AI) in it. In two or three short sentences, say what they talked about and anything they decided or Najimi found. Plain words, no names of the speakers' feelings, no quotes.\n\n${lines.map((l) => `${l.name}: ${l.text}`).join("\n")}`,
    maxOutputTokens: 160,
    providerOptions: { openai: { reasoningEffort: "low" } },
  }).catch(() => null)
  return read?.text.trim() || null
}

export async function joinCall({ room: roomName, chatId }: Payload<"callJoin">) {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: "najimi",
    name: "Najimi",
    ttl: CALLS.tokenTtlSeconds,
  })
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, agent: true })
  const {
    AudioSource,
    AudioStream,
    LocalAudioTrack,
    Room,
    RoomEvent,
    TrackKind,
    TrackPublishOptions,
    TrackSource,
  } = await livekit()
  const room = new Room()
  await room.connect(env.LIVEKIT_URL, await at.toJwt(), { autoSubscribe: true, dynacast: false })

  const source = new AudioSource(SPEAK_RATE, 1)
  const voice = LocalAudioTrack.createAudioTrack("najimi", source)
  const options = new TrackPublishOptions()
  options.source = TrackSource.SOURCE_MICROPHONE
  await room.localParticipant?.publishTrack(voice, options)

  const speakers = new Map<string, Speaker>()
  let busy = false
  const queue: { speaker: Speaker; text: string }[] = []

  const answerNext = async () => {
    if (busy) return
    const next = queue.shift()
    if (!next) return
    busy = true
    try {
      await speak(source, "One sec.")
      const reply = await askAloud({
        chatId,
        userId: next.speaker.identity,
        text: next.text,
        where: "a voice call with this chat's members",
      })
      if (reply) {
        await speak(source, reply)
        await addLine(roomName, {
          at: new Date().toISOString(),
          userId: null,
          name: "Najimi",
          text: reply,
        })
      }
    } catch (error) {
      console.error("[call] answer", (error as Error).message)
    } finally {
      busy = false
      void answerNext()
    }
  }

  const finish = async (s: Speaker) => {
    const frames = s.frames
    s.frames = null
    s.stoppedAt = null
    if (!frames) return
    const samples = join(frames)
    const ms = (samples.length / HEAR_RATE) * 1000
    if (ms < CALLS.minUtteranceMs) return
    const text = await transcribe(samples).catch(() => "")
    if (!text) return
    await addLine(roomName, {
      at: new Date().toISOString(),
      userId: s.identity,
      name: s.name,
      text,
    })
    // With one person in the call it's a conversation, and everything they say is for Najimi;
    // with more, Najimi answers only when someone says its name.
    const alone = room.remoteParticipants.size <= 1
    if ((alone && text.split(/\s+/).length >= 2) || ADDRESSED.test(text)) {
      queue.push({ speaker: s, text })
      void answerNext()
    }
  }

  const hear = async (track: RemoteTrack, p: RemoteParticipant) => {
    const s: Speaker = {
      identity: p.identity,
      name: p.name || "Someone",
      pre: [],
      frames: null,
      startedAt: 0,
      stoppedAt: null,
    }
    speakers.set(p.identity, s)
    for await (const frame of new AudioStream(track, { sampleRate: HEAR_RATE, numChannels: 1 })) {
      const pcm = new Int16Array(frame.data)
      if (s.frames) {
        s.frames.push(pcm)
        const ms = Date.now() - s.startedAt
        if (ms > CALLS.maxUtteranceMs) void finish(s)
      } else {
        s.pre.push(pcm)
        if (s.pre.length > 30) s.pre.shift()
      }
    }
  }

  room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
    if (track.kind === TrackKind.KIND_AUDIO && !participant.identity.startsWith("najimi"))
      void hear(track, participant).catch((e) => console.error("[call] hear", e))
  })
  room.on(RoomEvent.ActiveSpeakersChanged, (active: Participant[]) => {
    const now = Date.now()
    const talking = new Set(active.map((p) => p.identity))
    for (const s of speakers.values()) {
      if (talking.has(s.identity)) {
        s.stoppedAt = null
        if (!s.frames) {
          s.frames = [...s.pre]
          s.pre = []
          s.startedAt = now
        }
      } else if (s.frames && s.stoppedAt == null) s.stoppedAt = now
    }
  })

  await speak(
    source,
    room.remoteParticipants.size <= 1
      ? "Hi, I'm Najimi. Ask me anything: where to go tonight, what to watch, what to play."
      : "Hi, I'm Najimi. I'm listening; say my name when you want me.",
  )
  await addLine(roomName, {
    at: new Date().toISOString(),
    userId: null,
    name: "Najimi",
    text: "Joined the call.",
  })

  // The call's clock: utterances end after a pause, and Najimi leaves once everyone has gone.
  let emptySince: number | null = null
  while (room.isConnected) {
    await sleep(100)
    const now = Date.now()
    for (const s of speakers.values())
      if (s.frames && s.stoppedAt && now - s.stoppedAt > CALLS.endOfSpeechMs) void finish(s)
    const humans = [...room.remoteParticipants.values()].filter(
      (p) => !p.identity.startsWith("najimi"),
    )
    if (humans.length) emptySince = null
    else if (emptySince == null) emptySince = now
    else if (now - emptySince > CALLS.emptyLeaveMs) break
  }
  const summary = await summarise(roomName)
  await endCall(roomName, summary)
  await room.disconnect().catch(() => undefined)
}
