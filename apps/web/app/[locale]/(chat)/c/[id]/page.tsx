import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"
import { ChatView } from "@/components/chat/chat-view"
import { chatPageData } from "@/lib/chat/page-data"
import { messagesOf, ownedChat } from "@/lib/chat/store"
import { getSession } from "@/lib/session"

async function ExistingChat({ params }: { params: PageProps<"/[locale]/c/[id]">["params"] }) {
  const id = z.uuid().safeParse((await params).id).data
  if (!id) notFound()
  const session = await getSession()
  if (!session) redirect("/start")
  const chat = await ownedChat(session.user.id, id)
  if (!chat) notFound()
  const data = await chatPageData(session.user.id, chat.personId)
  if (!data.self) redirect("/start")
  return (
    <ChatView
      key={chat.id}
      chatId={chat.id}
      isNew={false}
      messages={messagesOf(chat)}
      status={chat.status}
      turnStartedAt={chat.turnStartedAt?.toISOString() ?? null}
      personId={chat.personId}
      mode={chat.mode}
      people={data.people}
      starters={data.starters}
      greetingName={data.person?.name ?? data.self.name}
    />
  )
}

export default function ChatPage(props: PageProps<"/[locale]/c/[id]">) {
  return (
    <Suspense fallback={null}>
      <ExistingChat params={props.params} />
    </Suspense>
  )
}
