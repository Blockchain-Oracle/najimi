import { randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { ChatView } from "@/components/chat/chat-view"
import { chatPageData } from "@/lib/chat/page-data"
import { getSession } from "@/lib/session"
import { isBuiltIn, runnableWorkflow } from "@/lib/workflows"

async function NewChat({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/c">["searchParams"]
}) {
  const query = await searchParams
  const slug = typeof query.workflow === "string" ? query.workflow : null
  // Someone new (often from a shared workflow link) meets Najimi first, then lands back here.
  const back = `/start?next=${encodeURIComponent(slug ? `/c?workflow=${slug}` : "/c")}`
  const session = await getSession()
  if (!session) redirect(back)
  const forParam = query.for
  const [data, workflow] = await Promise.all([
    chatPageData(session.user.id, typeof forParam === "string" ? forParam : null),
    slug ? runnableWorkflow(session.user.id, slug) : null,
  ])
  if (!data.self || !data.person) redirect(back)
  const t = await getTranslations("Workflows")
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
      workflow={workflow?.slug ?? null}
      workflowStart={
        workflow && !isBuiltIn(workflow)
          ? `${t("runMine", { name: workflow.name })}\n${workflow.instructions}`
          : null
      }
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
