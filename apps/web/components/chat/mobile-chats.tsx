"use client"

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@najimi/ui/components/sheet"
import { MessagesSquare } from "lucide-react"
import { useTranslations } from "next-intl"
import { Suspense } from "react"
import { ChatSidebar } from "./chat-sidebar"

/** On a phone the chats list lives in a sheet. */
export function MobileChats() {
  const t = useTranslations("Chat")
  return (
    <Sheet>
      <SheetTrigger className="inline-flex items-center gap-2 rounded-pill border border-foreground/15 px-3 py-1.5 text-sm font-semibold">
        <MessagesSquare className="size-4" /> {t("chats")}
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] border-0 bg-background p-0">
        <SheetTitle className="sr-only">{t("chats")}</SheetTitle>
        <Suspense fallback={null}>
          <ChatSidebar />
        </Suspense>
      </SheetContent>
    </Sheet>
  )
}
