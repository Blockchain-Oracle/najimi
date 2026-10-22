import { roomMessages } from "@najimi/agent/server"
import { ROOMS } from "@najimi/config"
import { lastEventId, topic } from "@najimi/live"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"
import { ChatView } from "@/components/chat/chat-view"
import { chatPageData } from "@/lib/chat/page-data"
import { membersOf, ownedChat } from "@/lib/chat/store"
import { getSession } from "@/lib/session"

async function ExistingChat({ params }: { params: PageProps<"/[locale]/c/[id]">["params"] }) {
  const id = z.uuid().safeParse((await params).id).data
  if (!id) notFound()
  const session = await getSession()
  if (!session) redirect("/start")
  const chat = await ownedChat(session.user.id, id)
  if (!chat) notFound()
  // The stream starts after the newest event, read before the messages: nothing falls between.
  const after = await lastEventId(topic.room(chat.id))
  const [data, messages, members] = await Promise.all([
    chatPageData(session.user.id, chat.personId),
    roomMessages(chat.id, { limit: ROOMS.pageSize }),
    chat.kind === "agent" ? Promise.resolve([]) : membersOf(chat.id),
  ])
  if (!data.self) redirect("/start")
  return (
    <ChatView
      key={chat.id}
      chatId={chat.id}
      kind={chat.kind}
      name={chat.name}
      members={members}
      invite={chat.kind === "circle" && chat.inviteToken ? `/join/${chat.inviteToken}` : null}
      isNew={false}
      title={chat.title}
      messages={messages}
      status={chat.status}
      after={after}
      me={session.user.id}
      mode={chat.mode}
      people={data.people}
      starters={data.starters}
      taste={data.taste}
      greetingName={data.self.name}
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
