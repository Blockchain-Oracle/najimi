import { askAloud } from "@najimi/agent/server"
import { readToolToken } from "@najimi/booking/calls"
import { CALLS } from "@najimi/config"

/*
 * Najimi, on a phone call it was added to, was asked something: the question goes into that
 * call's Najimi chat as the person's, Najimi's usual turn answers it there, and the first line or
 * two comes back for the phone agent to say.
 */
export async function POST(request: Request) {
  const token = readToolToken("phone", request.headers.get("x-najimi-token"))
  if (!token) return Response.json({ error: "Not allowed" }, { status: 401 })
  const { question } = (await request.json().catch(() => ({}))) as { question?: string }
  const text = question?.trim().slice(0, 600)
  if (!text) return Response.json({ answer: "Sorry, I didn't catch the question." })
  const answer = await askAloud({
    chatId: token.chatId,
    userId: token.userId,
    text,
    where: "a phone call they added you to, with other people on it",
    waitMs: CALLS.phoneAnswerWaitMs,
  })
  return Response.json({ answer: answer ?? "I couldn't look that up." })
}
