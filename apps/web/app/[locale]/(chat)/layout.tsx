import { Suspense } from "react"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { MobileChats } from "@/components/chat/mobile-chats"
import { AppHeader } from "@/components/shell/app-header"
import { emailEnabled, googleEnabled } from "@/lib/auth"

export default function ChatLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <AppHeader google={googleEnabled} email={emailEnabled} />
      <div className="mx-auto grid w-full max-w-7xl md:grid-cols-[16rem_1fr]">
        <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] border-e border-border md:block">
          <Suspense fallback={null}>
            <ChatSidebar />
          </Suspense>
        </aside>
        <main className="min-w-0">
          <div className="px-4 pt-2 md:hidden">
            <MobileChats />
          </div>
          {children}
        </main>
      </div>
    </>
  )
}
