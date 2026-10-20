import "server-only"
import { LIVE } from "@najimi/config"
import { pg } from "@najimi/db"
import type { RunNotice } from "@najimi/live"

/*
 * One LISTEN on the run-events channel for the whole web process, fanned out to every open stream
 * that's watching that run. Notices carry ids only; each stream reads its rows itself (and checks
 * the run is the viewer's). After a reconnect of the LISTEN connection, every stream re-reads, so a
 * notice lost in the gap can't leave a page behind.
 */

type Listener = { onNotice: (notice: RunNotice) => void; onReconnect: () => void }
type Hub = { byRun: Map<string, Set<Listener>>; listening: Promise<unknown> | null }

const g = globalThis as typeof globalThis & { __najimiLive?: Hub }
g.__najimiLive ??= { byRun: new Map(), listening: null }
const hub = g.__najimiLive

function listen() {
  hub.listening ??= pg
    .listen(
      LIVE.channel,
      (payload) => {
        let notice: RunNotice
        try {
          notice = JSON.parse(payload) as RunNotice
        } catch {
          return
        }
        for (const listener of hub.byRun.get(notice.runId) ?? []) listener.onNotice(notice)
      },
      // fires on first listen and after every reconnect
      () => {
        for (const listeners of hub.byRun.values()) for (const l of listeners) l.onReconnect()
      },
    )
    .catch((error) => {
      hub.listening = null
      console.error("[live] listen", error)
    })
  return hub.listening
}

/** Watches one run; returns the function that stops watching. */
export async function watchRun(runId: string, listener: Listener): Promise<() => void> {
  const set = hub.byRun.get(runId) ?? new Set()
  set.add(listener)
  hub.byRun.set(runId, set)
  await listen()
  return () => {
    set.delete(listener)
    if (!set.size) hub.byRun.delete(runId)
  }
}
