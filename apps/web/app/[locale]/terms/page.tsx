import { LEGAL } from "@najimi/config"
import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, Part } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms for using Najimi: your account, what you post, what Najimi does for you, and the services it works with.",
  alternates: { canonical: "/terms" },
}

/** /terms: the terms of service, in plain words. */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      lead="These terms cover using Najimi at najimi.xyz: the taste app, its agent in your chats, and everything it does for you. By using Najimi you agree to them."
    >
      <Part title="Your account">
        <ul>
          <li>You can start as a guest, then sign in with an email code, Google or TikTok.</li>
          <li>You must be at least 13, and old enough where you live to agree to these terms.</li>
          <li>
            Keep your sign-in to yourself. You're responsible for what happens in your account.
          </li>
        </ul>
      </Part>

      <Part title="What you post">
        <p>
          Your messages, stories, photos and polls stay yours. You let Najimi store and show them to
          the people you chose, so the app can work. Don't post anything you don't have the right to
          share, anything illegal, or anything that harasses, threatens or impersonates someone.
          Najimi can remove content and close accounts that break these rules, and reports reach its
          owner.
        </p>
      </Part>

      <Part title="What Najimi does for you">
        <ul>
          <li>
            Najimi's picks come from Qloo's taste data and its words from AI models. They can be
            wrong: check opening hours, prices and details before you go.
          </li>
          <li>
            Najimi only phones a venue, posts in your name or acts on a connected account after your
            yes on the exact script, post or action. Calls are recorded and the caller says it's an
            AI.
          </li>
          <li>
            If you let Najimi act on your X or Instagram, you do so under those platforms' own
            rules, and they can limit accounts that automate. You can disconnect at any time.
          </li>
        </ul>
      </Part>

      <Part title="Bookings and payments">
        <p>
          Hotel rooms are sold and charged by Nuitee, the merchant of record, under its own terms;
          you pay in Nuitee's payment sheet and Najimi never sees your card. A table booked by phone
          is between you and the venue. Najimi doesn't charge you anything.
        </p>
      </Part>

      <Part title="Other services">
        <p>
          Najimi plays previews and opens links from Apple, YouTube, Spotify, TMDB, Ticketmaster,
          Uber, Google Maps and others. Using them is covered by their own terms. If you connect
          YouTube, you also agree to the{" "}
          <a href="https://www.youtube.com/t/terms" className="underline underline-offset-4">
            YouTube Terms of Service
          </a>
          .
        </p>
      </Part>

      <Part title="Privacy">
        <p>
          What Najimi keeps and shares is in the{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          . You can delete everything from Settings at any time.
        </p>
      </Part>

      <Part title="No guarantees">
        <p>
          Najimi is provided as it is, without warranties. As far as the law allows, Najimi and its
          makers aren't liable for indirect losses, or for what happens at places, bookings or
          services it suggests or links to.
        </p>
      </Part>

      <Part title="Changes and contact">
        <p>
          When these terms change, the date at the top changes too, and using Najimi afterwards
          means you accept them. These terms are governed by the laws of Nigeria. Questions:{" "}
          <a href={`mailto:${LEGAL.contact}`} className="underline underline-offset-4">
            {LEGAL.contact}
          </a>
          .
        </p>
      </Part>
    </LegalPage>
  )
}
