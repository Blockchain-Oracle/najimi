import { randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { ChatView } from "@/components/chat/chat-view"
import { chatPageData } from "@/lib/chat/page-data"
import { getSession } from "@/lib/session"

async function NewChat({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/c">["searchParams"]
}) {
  const session = await getSession()
  if (!session) redirect("/start")
  const query = await searchParams
  const forParam = query.for
  const workflow =
    typeof query.workflow === "string" && /^[a-z-]{3,40}$/.test(query.workflow)
      ? query.workflow
      : null
  const data = await chatPageData(session.user.id, typeof forParam === "string" ? forParam : null)
  if (!data.self || !data.person) redirect("/start")
  return (
    <ChatView
      chatId={randomUUID()}
      isNew
      messages={[]}
      status="idle"
      turnStartedAt={null}
      personId={data.person.id}
      mode={data.mode}
      people={data.people}
      starters={data.starters}
      greetingName={data.person.isSelf ? data.self.name : data.person.name}
      workflow={workflow}
    />
  )
}

/** A new chat: nothing is saved until the first message. */
export default function NewChatPage(props: PageProps<"/[locale]/c">) {
  return (
    <Suspense fallback={null}>
      <NewChat searchParams={props.searchParams} />
    </Suspense>
  )
}
