"use client"

import { useChat } from "@ai-sdk/react"
import type { NajimiUIMessage } from "@najimi/agent"
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai"
import { useMemo } from "react"

type AutoSend = { messages: NajimiUIMessage[] }

/** The person answered an approval themselves (an automatic one needs no answer back). */
const personAnswered = ({ messages }: AutoSend) =>
  messages
    .at(-1)
    ?.parts.some(
      (p) => isToolUIPart(p) && p.state === "approval-responded" && p.approval.isAutomatic !== true,
    ) ?? false

/** Continue by itself once every pending card has its answer (a wizard filled in, an approval given). */
const continueAutomatically = (input: AutoSend) =>
  lastAssistantMessageIsCompleteWithToolCalls(input) ||
  (personAnswered(input) && lastAssistantMessageIsCompleteWithApprovalResponses(input))

/**
 * The chat's connection: only the newest message goes up (the server keeps the conversation).
 * Updates are batched while cards stream.
 */
export function useNajimiChat(chatId: string, initial: NajimiUIMessage[]) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<NajimiUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => ({
          body: {
            id,
            message: messages[messages.length - 1],
            trigger,
            messageId,
          },
        }),
      }),
    [],
  )
  return useChat<NajimiUIMessage>({
    id: chatId,
    messages: initial,
    transport,
    throttle: 50,
    sendAutomaticallyWhen: continueAutomatically,
  })
}
