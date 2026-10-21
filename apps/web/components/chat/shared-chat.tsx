"use client"

import type { NajimiUIMessage } from "@najimi/agent"
import { Message } from "./message"
import { PublicShareProvider } from "./public-share"

const noop = () => undefined

/** A chat as its owner shared it: the words and the cards, read-only, with no private photos. */
export function SharedChat({
  token,
  ready,
  messages,
}: {
  token: string
  ready: string[]
  messages: NajimiUIMessage[]
}) {
  return (
    <PublicShareProvider value={{ token, ready }}>
      <div className="flex flex-col gap-8">
        {messages.map((m) => (
          <Message
            key={m.id}
            message={m}
            streaming={false}
            actions={{ live: false, onAsk: noop, onAnswer: noop, onApprove: noop }}
          />
        ))}
      </div>
    </PublicShareProvider>
  )
}
