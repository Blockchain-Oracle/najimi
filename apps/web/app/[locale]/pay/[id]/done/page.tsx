import { Orb } from "@najimi/ui/components/orb"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { BookingDone } from "@/components/booking/booking-done"
import { bookingView, ownedBooking } from "@/lib/bookings"
import { getSession } from "@/lib/session"

type Props = PageProps<"/[locale]/pay/[id]/done">

async function Done({ params }: Pick<Props, "params">) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/start?next=${encodeURIComponent(`/pay/${id}/done`)}`)
  const booking = await ownedBooking(session.user.id, id)
  if (!booking) notFound()
  return <BookingDone initial={bookingView(booking)} />
}

/** Back from the payment sheet: the booking is made here, then shown. */
export default function DonePage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="dark grid min-h-dvh place-items-center bg-background">
          <Orb size={88} working />
        </main>
      }
    >
      <Done params={params} />
    </Suspense>
  )
}
