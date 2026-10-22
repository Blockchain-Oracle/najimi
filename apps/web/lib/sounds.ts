"use client"

import { SOUNDS, type UiSound } from "@najimi/config"

/*
 * Najimi's sound engine, ported from Konkyo (which took it from OurSpaces): one Web Audio context
 * unlocked by the first tap (browsers allow audio only after a gesture), buffers decoded once and
 * played with no latency. Soft, short and optional; the choice is kept per browser.
 */

let context: AudioContext | null = null
const buffers = new Map<string, AudioBuffer>()
const pending = new Map<string, Promise<void>>()

function ctx() {
  if (context || typeof window === "undefined") return context
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  context = Ctx ? new Ctx() : null
  return context
}

/** Fetches and decodes one sound once; a sound that won't load is simply skipped. */
function loadSound(url: string) {
  const audio = ctx()
  if (!audio || buffers.has(url)) return Promise.resolve()
  const running = pending.get(url)
  if (running) return running
  const job = fetch(url)
    .then((res) => res.arrayBuffer())
    .then((bytes) => audio.decodeAudioData(bytes))
    .then((buffer) => void buffers.set(url, buffer))
    .catch(() => undefined)
  pending.set(url, job)
  return job
}

/** Call from the first tap: unlocks audio and starts fetching the interface sounds. */
export function primeSounds() {
  const audio = ctx()
  if (!audio) return
  if (audio.state === "suspended") void audio.resume()
  for (const url of Object.values(SOUNDS.files)) void loadSound(url)
}

let enabled: boolean | null = null

/** Sounds are on unless the person turned them off in this browser. */
export function soundsOn() {
  if (enabled !== null) return enabled
  if (typeof window === "undefined") return true
  try {
    enabled = window.localStorage.getItem(SOUNDS.storageKey) !== "off"
  } catch {
    enabled = true
  }
  return enabled
}

export function setSounds(on: boolean) {
  enabled = on
  try {
    window.localStorage.setItem(SOUNDS.storageKey, on ? "on" : "off")
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  if (on) sound("tap")
}

/** Plays an interface sound if sounds are on (silent until the first tap has unlocked audio). */
export function sound(name: UiSound) {
  if (!soundsOn()) return
  primeSounds()
  const audio = context
  const buffer = buffers.get(SOUNDS.files[name])
  if (!audio || !buffer || audio.state !== "running") return
  const source = audio.createBufferSource()
  const gain = audio.createGain()
  gain.gain.value = SOUNDS.volumes[name]
  source.buffer = buffer
  source.connect(gain).connect(audio.destination)
  source.start()
}
