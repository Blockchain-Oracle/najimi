import { AppHeader } from "@/components/shell/app-header"
import { emailEnabled, googleEnabled } from "@/lib/auth"

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <AppHeader google={googleEnabled} email={emailEnabled} />
      <main className="mx-auto w-full max-w-5xl pt-4 max-sm:pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:px-5">
        {children}
      </main>
    </>
  )
}
