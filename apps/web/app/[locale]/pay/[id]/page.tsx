import { paymentMode } from "@najimi/booking/nuitee"
import { Orb } from "@najimi/ui/components/orb"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { PayView } from "@/components/booking/pay-view"
import { bookingView, ownedBooking } from "@/lib/bookings"
import { getSession } from "@/lib/session"

type Props = PageProps<"/[locale]/pay/[id]">

async function Pay({ params }: Pick<Props, "params">) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/start?next=${encodeURIComponent(`/pay/${id}`)}`)
  const booking = await ownedBooking(session.user.id, id)
  if (!booking) notFound()
  if (booking.status !== "prebooked") redirect(`/pay/${id}/done`)
  const data = booking.data as { secretKey?: string; holder?: Record<string, string> }
  return (
    <PayView
      booking={bookingView(booking)}
      secretKey={data.secretKey ?? ""}
      mode={paymentMode()}
      holder={
        data.holder ?? {
          email:
            session.user.email.includes("@") && !session.user.isAnonymous ? session.user.email : "",
        }
      }
    />
  )
}

/** Paying for a held room, in Nuitee's own payment sheet. */
export default function PayPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="dark grid min-h-dvh place-items-center bg-background">
          <Orb size={88} working />
        </main>
      }
    >
      <Pay params={params} />
    </Suspense>
  )
}
