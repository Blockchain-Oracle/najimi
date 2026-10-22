import { randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { ChatView } from "@/components/chat/chat-view"
import { chatPageData } from "@/lib/chat/page-data"
import { getSession } from "@/lib/session"

async function NewChat({ ask }: { ask: Promise<string | undefined> }) {
  // Someone new meets Najimi first, then lands back here.
  const back = `/start?next=${encodeURIComponent("/c")}`
  const session = await getSession()
  if (!session) redirect(back)
  const data = await chatPageData(session.user.id, null)
  if (!data.self || !data.person) redirect(back)
  return (
    <ChatView
      chatId={randomUUID()}
      isNew
      title={null}
      messages={[]}
      status="idle"
      after={0}
      me={session.user.id}
      mode={data.mode}
      people={data.people}
      starters={data.starters}
      taste={data.taste}
      greetingName={data.self.name}
      ask={(await ask)?.slice(0, 500)}
    />
  )
}

/** A new chat: nothing is saved until the first message. */
export default function NewChatPage({ searchParams }: PageProps<"/[locale]/c">) {
  const ask = searchParams.then((p) => (typeof p.ask === "string" ? p.ask : undefined))
  return (
    <Suspense fallback={null}>
      <NewChat ask={ask} />
    </Suspense>
  )
}
