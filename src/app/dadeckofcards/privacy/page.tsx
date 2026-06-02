import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Deck of Cards — Privacy Policy",
  description:
    "The privacy policy for Deck of Cards, the iOS card game platform. Deck of Cards collects no personal data.",
  alternates: { canonical: "/dadeckofcards/privacy" },
};

const EFFECTIVE_DATE = "2 June 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <FadeIn>
      <section className="mt-12">
        <div className="section-line" />
        <h2 className="mt-12 text-2xl font-bold text-foreground">{title}</h2>
        <div className="mt-4 space-y-4 text-muted leading-relaxed">
          {children}
        </div>
      </section>
    </FadeIn>
  );
}

export default function DaDeckOfCardsPrivacyPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        {/* Header */}
        <FadeIn>
          <p className="text-xs tracking-widest text-accent-warm/70 uppercase">
            Deck of Cards · Legal
          </p>
          <h1 className="mt-6 text-5xl sm:text-6xl text-foreground font-bold">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm tracking-wide text-muted/60">
            Effective {EFFECTIVE_DATE}
          </p>
        </FadeIn>

        {/* Short version */}
        <FadeIn delay={0.1}>
          <div className="card-glow card-glow-warm mt-10 rounded-2xl border border-card-border bg-card-bg/50 p-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-warm/80">
              Short version
            </p>
            <p className="mt-3 text-muted leading-relaxed">
              <strong className="text-foreground font-medium">
                Deck of Cards does not collect, store, or share your personal
                data.
              </strong>{" "}
              There are no analytics SDKs, no tracking, no advertising, and no
              servers run by us. Your settings and custom decks stay on your
              device. Multiplayer and subscriptions are handled by Apple under
              Apple&apos;s own privacy terms.
            </p>
          </div>
        </FadeIn>

        <Section title="Who we are">
          <p>
            Deck of Cards is an iOS app published by{" "}
            <strong className="text-foreground font-medium">
              Henceforth Bitcoin Limited
            </strong>{" "}
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains how the
            app handles information. It applies to the Deck of Cards app on
            iPhone and iPad.
          </p>
        </Section>

        <Section title="Data we collect">
          <p>
            <strong className="text-foreground font-medium">None.</strong> The
            app does not collect, transmit, or sell personal data. We do not run
            analytics, advertising, or tracking of any kind. Apple&apos;s
            App&nbsp;Tracking Transparency does not apply because the app does
            not track you across other companies&apos; apps or websites.
          </p>
        </Section>

        <Section title="Data stored on your device">
          <p>
            Your preferences, appearance settings, custom decks, and any photo
            you choose as a card back are stored locally on your device. This
            information never leaves your device through us and is removed when
            you delete the app.
          </p>
          <p>
            If you select a photo for a custom card back, the app reads only the
            image you pick and keeps it on the device. It is not uploaded
            anywhere.
          </p>
        </Section>

        <Section title="Multiplayer (Apple Game Center)">
          <p>
            Real-time multiplayer is provided by Apple&apos;s Game Center. When
            you host or join a match, Game Center supplies a pseudonymous player
            identifier so card moves can be routed between the players in your
            match. Card positions and moves are exchanged peer-to-peer through
            Game Center.
          </p>
          <p>
            We do not operate game servers, and we do not store your Game Center
            identity or match data. Game Center is governed by{" "}
            <a
              href="https://www.apple.com/legal/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-warm hover:underline"
            >
              Apple&apos;s Privacy Policy
            </a>
            . You can manage your Game Center settings in the iOS Settings app.
          </p>
        </Section>

        <Section title="Subscriptions (Apple StoreKit)">
          <p>
            Multiplayer can be unlocked with an optional auto-renewing
            subscription. All purchases are processed by Apple through the App
            Store using StoreKit. We never receive or store your payment card
            details. Apple provides us only aggregate, non-identifying sales and
            subscription reporting.
          </p>
          <p>
            You can manage or cancel a subscription at any time in the App Store
            under your Apple Account&apos;s subscriptions. Subscriptions are
            covered by{" "}
            <a
              href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-warm hover:underline"
            >
              Apple&apos;s standard Terms of Use (EULA)
            </a>
            .
          </p>
        </Section>

        <Section title="Third parties">
          <p>
            The app uses only Apple&apos;s own frameworks — Game Center for
            multiplayer and StoreKit for subscriptions. There are no third-party
            SDKs, no ad networks, and no external analytics providers.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Because the app collects no personal data and shows no advertising,
            it does not knowingly gather information from children or anyone
            else.
          </p>
        </Section>

        <Section title="Your choices and deletion">
          <p>
            Since we hold no personal data about you, there is nothing for us to
            access, correct, or delete. Data stored on your device is removed by
            deleting the app. Game Center data is managed by Apple in the iOS
            Settings app.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes, we will post the updated version on this
            page with a new effective date.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or the app? Email{" "}
            <a
              href="mailto:henry@henceforth.club"
              className="text-accent-warm hover:underline"
            >
              henry@henceforth.club
            </a>
            .
          </p>
          <p className="pt-2">
            <Link
              href="/dadeckofcards"
              className="text-sm text-muted/60 hover:text-foreground transition-colors"
            >
              ← Back to Deck of Cards
            </Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
