import { AppHeader, RAIL_WIDTH } from "@/components/shell/app-header"
import { emailEnabled, googleEnabled } from "@/lib/auth"

/** Chats: the conversation takes the whole width; history is a sheet from the chat's header. */
export default function ChatLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <AppHeader google={googleEnabled} email={emailEnabled} />
      <div className={RAIL_WIDTH}>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  )
}
