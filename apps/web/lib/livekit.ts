import "server-only"
import { endCall, liveCall } from "@najimi/agent/server"
import { CALLS } from "@najimi/config"
import { env } from "@najimi/env/server"
import { enqueue } from "@najimi/jobs"
import { AccessToken, RoomServiceClient, WebhookReceiver } from "livekit-server-sdk"

/*
 * LiveKit, Najimi's own call server: signed tokens for the members of a chat's call (nobody else
 * can join), Najimi sent in through the worker, and its webhooks checked by signature.
 */

export const callsReady = () =>
  Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET)

function keys() {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET)
    throw new Error("Calls aren't switched on yet")
  return { url: env.LIVEKIT_URL, key: env.LIVEKIT_API_KEY, secret: env.LIVEKIT_API_SECRET }
}

/** A member's pass into one call's room. */
export async function callToken(room: string, identity: string, name: string) {
  const { key, secret, url } = keys()
  const at = new AccessToken(key, secret, { identity, name, ttl: CALLS.tokenTtlSeconds })
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true })
  return { token: await at.toJwt(), url }
}

/**
 * The chat's call if it's really going. LiveKit only makes a room when someone joins, so a call
 * whose screen was closed before it connected sends no "room finished": after a short grace, no
 * room on the server means nobody came, and its card closes.
 */
export async function openCall(chatId: string) {
  const call = await liveCall(chatId)
  if (!call || Date.now() - call.startedAt.getTime() < CALLS.joinGraceMs) return call
  const { url, key, secret } = keys()
  const rooms = await new RoomServiceClient(url, key, secret)
    .listRooms([call.room])
    .catch(() => null)
  if (rooms && !rooms.some((r) => r.numParticipants > 0)) {
    // Its length isn't known (it may never have connected), so the card says only that it ended.
    await endCall(call.room, null, { timed: false })
    return null
  }
  return call
}

/**
 * Someone left: when nobody else is still in the room (Najimi doesn't count), the call ends now,
 * rather than when the server's departure timer runs out, and Najimi is let go with it.
 */
export async function leaveCall(chatId: string, userId: string) {
  const call = await liveCall(chatId)
  if (!call) return null
  const { url, key, secret } = keys()
  const rooms = new RoomServiceClient(url, key, secret)
  // Not knowing who's there is not "nobody": then the server's own timer ends it.
  const people = await rooms.listParticipants(call.room).catch(() => null)
  if (!people) return call
  const others = people.filter(
    (p) => p.identity !== userId && !p.identity.startsWith(CALLS.agentName),
  )
  if (others.length) return call
  await rooms.deleteRoom(call.room).catch(() => undefined)
  return endCall(call.room)
}

/** Sends Najimi into the room: the worker joins it as its own participant and stays the call. */
export async function dispatchNajimi(call: { room: string; chatId: string; id: string }) {
  keys()
  await enqueue("callJoin", { room: call.room, chatId: call.chatId, callId: call.id }, call.room)
}

export function livekitWebhooks() {
  const { key, secret } = keys()
  return new WebhookReceiver(key, secret)
}
