import { AppHeader, RAIL_WIDTH } from "@/components/shell/app-header"
import { emailEnabled, googleEnabled } from "@/lib/auth"

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <AppHeader google={googleEnabled} email={emailEnabled} />
      <div className={RAIL_WIDTH}>
        <main className="mx-auto w-full max-w-5xl pt-4 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:pt-8">
          {children}
        </main>
      </div>
    </>
  )
}
