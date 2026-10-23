import { AUTH, LEGAL } from "@najimi/config"
import type { Metadata } from "next"
import { LegalPage, Part, Who } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Najimi keeps, what leaves it and why, who sees your taste, and how to delete everything.",
  alternates: { canonical: "/privacy" },
}

/** /privacy: the privacy policy, in plain words, true to what the app does. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      lead="Najimi is a taste app and an agent for your group chats. This is what it keeps about you, what it sends to other services and why, who can see your taste, and how to delete all of it."
    >
      <Part title="What Najimi keeps">
        <ul>
          <li>
            <strong>Your account:</strong> a guest account, or an email or Google sign-in, and your
            username.
          </li>
          <li>
            <strong>Your taste:</strong> the things you love and how much, your taste's words and
            picks, what you saw, played, opened, loved, saved or hid, and your city if you gave one.
          </li>
          <li>
            <strong>Chats:</strong> your messages, Najimi's answers, the circles and direct messages
            you're in, polls and votes.
          </li>
          <li>
            <strong>Stories:</strong> for 24 hours, then deleted with their files, along with who
            saw them and their reactions.
          </li>
          <li>
            <strong>Plans, bookings and games:</strong> so Najimi can follow up and add them to your
            Passport.
          </li>
          <li>
            <strong>Photos you share:</strong> re-encoded when they arrive (which removes location
            and camera data) and stored privately.
          </li>
          <li>
            <strong>Connected accounts:</strong> if you let Najimi act for you on X or Instagram,
            your session is sealed (AES-256-GCM) the moment it arrives, opened only on the server to
            act when you said so, never shown again, and deleted when you disconnect.
          </li>
          <li>
            <strong>Businesses:</strong> what you told Najimi about a place you run, and the plans
            it built.
          </li>
          <li>
            <strong>Usage:</strong> today's counts for your allowances, and what Najimi's thinking
            cost for you.
          </li>
        </ul>
      </Part>

      <Part title="What leaves Najimi, and why">
        <p>
          Only what the thing you asked for needs. Najimi does not sell your data or show you ads.
        </p>
        <Who
          rows={[
            [
              "Qloo",
              "The ids of the things you love and their weights, tags, a city or a point on the map. Never your name.",
            ],
            [
              "OpenAI",
              "The conversation and its context so Najimi can answer; a feed screenshot you score (read, never kept); the text of posts you bring in, to find the names in them; a business's website; web searches Najimi makes, with your city as a rough location.",
            ],
            ["fal", "A photo you asked Najimi to restyle, and the words for the picture."],
            ["ElevenLabs", "A voice message you dictate, to turn into text."],
            [
              "ElevenLabs and Twilio",
              "For a phone call you approved: the venue's number, your name and the booking details. The call is recorded.",
            ],
            [
              "Nuitee",
              "Your name, email and phone when you book a room. You pay in Nuitee's own payment sheet; Najimi never sees your card.",
            ],
            ["Resend", "Your email address, to send a sign-in code."],
            [
              "Apple, TMDB, Ticketmaster, Mapbox, Wikidata, OpenStreetMap",
              "Names, places and times to look up. Never who you are.",
            ],
            [
              "Your phone's push service",
              "The notification itself, for the device you turned notifications on for.",
            ],
          ]}
        />
      </Part>

      <Part title="Data you bring in from other platforms">
        <p>
          You can bring your taste in from other platforms. Nothing is read until you choose to, and
          you review every match before it becomes part of your taste.
        </p>
        <ul>
          <li>
            <strong>Downloaded data (X, Instagram, TikTok, YouTube, Spotify):</strong> the file each
            platform gives you is opened in your own browser. Only the short lists inside it
            (account handles, artist, channel and show names, and the titles or captions that name
            them) are sent on, to be matched to Qloo. The file itself never leaves your device.
          </li>
          <li>
            <strong>Usernames and handles:</strong> public pages on Letterboxd, Goodreads, Last.fm
            and X are read by name.
          </li>
        </ul>
      </Part>

      <Part title="Google and YouTube">
        <p>
          If you sign in with Google, Najimi receives your name, email address and profile picture
          to create your account. If you connect YouTube, Najimi asks Google for read-only access to
          your YouTube account and reads the channels you subscribe to and the videos you liked, to
          find the artists, shows and creators you love. You see each match and keep only what's
          you.
        </p>
        <ul>
          <li>Najimi uses this data only to suggest things you love inside Najimi.</li>
          <li>
            It is not sold, not used for advertising, not shared with anyone except the matching
            described above, and not used to train AI models.
          </li>
          <li>
            Najimi keeps the matches you choose to keep, not your raw subscription or like lists.
          </li>
          <li>
            Disconnect YouTube in Settings, or remove Najimi's access at
            myaccount.google.com/permissions, at any time; Settings → Delete all my data removes
            everything.
          </li>
        </ul>
        <p>
          Najimi's use and transfer of information received from Google APIs to any other app will
          adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="underline underline-offset-4"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Najimi's use of YouTube data is also subject to
          the{" "}
          <a href="https://www.youtube.com/t/terms" className="underline underline-offset-4">
            YouTube Terms of Service
          </a>{" "}
          and the{" "}
          <a href="https://policies.google.com/privacy" className="underline underline-offset-4">
            Google Privacy Policy
          </a>
          .
        </p>
      </Part>

      <Part title="TikTok">
        <p>
          If you sign in with TikTok, Najimi receives your TikTok display name, avatar and profile
          link, and, if you allow it, a list of your own public videos, used as a light signal of
          your taste. It is used only inside Najimi, never sold or used for advertising, and removed
          when you disconnect or delete your data.
        </p>
      </Part>

      <Part title="Who sees your taste">
        <p>
          <strong>Settings → Who sees your taste</strong>: everyone, friends (people who follow each
          other), or only you. The same setting decides who sees your stories. A private taste
          doesn't appear in search, taste twins, the radar or the map. The radar is off until you
          turn it on.
        </p>
        <p>
          <strong>Block</strong> someone and you disappear from each other. <strong>Report</strong>{" "}
          someone and the report reaches Najimi's owner, and they're blocked too.
        </p>
      </Part>

      <Part title="What Najimi never does without your yes">
        <ul>
          <li>
            Phone anyone, or post in your name: you approve the exact call script or post first.
          </li>
          <li>Pay for anything: you pay hotels yourself, in Nuitee's sheet.</li>
          <li>Say something is booked before the booking confirms it.</li>
        </ul>
      </Part>

      <Part title="Keeping and deleting">
        <p>
          Your data stays while your account exists. <strong>Settings → Delete all my data</strong>{" "}
          removes your account and everything in it: your taste, chats, plans, games, connected
          accounts, businesses, notification subscriptions, files and share links. It can't be
          undone. Guest accounts nobody has used for {AUTH.guestKeepDays} days are deleted the same
          way.
        </p>
      </Part>

      <Part title="Security">
        <p>
          Everything travels over HTTPS. Photos and files are stored privately and reached through
          signed, short-lived links. Connected sessions are encrypted at rest and only opened on the
          server.
        </p>
      </Part>

      <Part title="Children">
        <p>Najimi is not meant for anyone under 13, and doesn't knowingly keep their data.</p>
      </Part>

      <Part title="Changes and contact">
        <p>
          When this policy changes, the date at the top changes too. Questions, or a request about
          your data:{" "}
          <a href={`mailto:${LEGAL.contact}`} className="underline underline-offset-4">
            {LEGAL.contact}
          </a>
          .
        </p>
      </Part>
    </LegalPage>
  )
}
