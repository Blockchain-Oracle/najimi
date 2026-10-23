import { AppHeader } from "@/components/shell/app-header"
import { signInWith } from "@/lib/auth"

/** Full-bleed screens: the shell's rail and tab bar, but no phone top bar (the screen has its own). */
export default function FeedLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <AppHeader sign={signInWith} bare />
      <main>{children}</main>
    </>
  )
}
