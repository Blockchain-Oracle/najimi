import { AppHeader } from "@/components/shell/app-header"
import { emailEnabled, googleEnabled } from "@/lib/auth"

/** Full-bleed screens: the shell's rail and tab bar, but no phone top bar (the screen has its own). */
export default function FeedLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <AppHeader google={googleEnabled} email={emailEnabled} bare />
      <main>{children}</main>
    </>
  )
}
