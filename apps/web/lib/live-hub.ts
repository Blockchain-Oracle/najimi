import "server-only"
import { LIVE } from "@najimi/config"
import { pg } from "@najimi/db"
import type { LiveNotice } from "@najimi/live"

/*
 * One LISTEN on the live channel for the whole web process, fanned out to every open stream
 * watching that topic. Notices carry ids only; each stream reads its rows itself (after checking
 * the viewer may). After a reconnect of the LISTEN connection, every stream re-reads, so a notice
 * lost in the gap can't leave a page behind.
 */

type Listener = { onNotice: (notice: LiveNotice) => void; onReconnect: () => void }
type Hub = { byTopic: Map<string, Set<Listener>>; listening: Promise<unknown> | null }

const g = globalThis as typeof globalThis & { __najimiLiveHub?: Hub }
g.__najimiLiveHub ??= { byTopic: new Map(), listening: null }
const hub = g.__najimiLiveHub

function listen() {
  hub.listening ??= pg
    .listen(
      LIVE.channel,
      (payload) => {
        let notice: LiveNotice
        try {
          notice = JSON.parse(payload) as LiveNotice
        } catch {
          return
        }
        for (const listener of hub.byTopic.get(notice.topic) ?? []) listener.onNotice(notice)
      },
      // fires on first listen and after every reconnect
      () => {
        for (const listeners of hub.byTopic.values()) for (const l of listeners) l.onReconnect()
      },
    )
    .catch((error) => {
      hub.listening = null
      console.error("[live] listen", error)
    })
  return hub.listening
}

/** Watches one topic; returns the function that stops watching. */
export async function watch(name: string, listener: Listener): Promise<() => void> {
  const set = hub.byTopic.get(name) ?? new Set()
  set.add(listener)
  hub.byTopic.set(name, set)
  await listen()
  return () => {
    set.delete(listener)
    if (!set.size) hub.byTopic.delete(name)
  }
}
