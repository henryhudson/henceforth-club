import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Hansard — Privacy Policy",
  description:
    "The privacy policy for Hansard, the UK Parliament browser for iPhone and iPad. Hansard collects no personal data.",
  alternates: { canonical: "/hansard/privacy" },
};

const EFFECTIVE_DATE = "1 July 2026";

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

export default function HansardPrivacyPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        {/* Header */}
        <FadeIn>
          <p className="text-xs tracking-widest text-accent-warm/70 uppercase">
            Hansard · Legal
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
                Hansard does not collect, store, or share your personal data.
              </strong>{" "}
              There are no analytics, no tracking, no advertising, and no servers
              run by us. Your settings stay on your device, and Parliament data
              is fetched directly from the public UK Parliament APIs.
            </p>
          </div>
        </FadeIn>

        <Section title="Who we are">
          <p>
            Hansard is an iOS app published by{" "}
            <strong className="text-foreground font-medium">
              Henceforth Bitcoin Limited
            </strong>{" "}
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains how the app
            handles information. It applies to the Hansard app on iPhone and iPad.
          </p>
        </Section>

        <Section title="Data we collect">
          <p>
            <strong className="text-foreground font-medium">None.</strong> The app
            does not collect, transmit, or sell personal data. We run no
            analytics, no advertising, and no tracking of any kind. Apple&apos;s
            App&nbsp;Tracking Transparency does not apply, because the app does not
            track you across other companies&apos; apps or websites.
          </p>
        </Section>

        <Section title="Data stored on your device">
          <p>
            Your settings, the MPs you follow for notifications, and any cached
            Parliament data are stored locally on your device (and in your private
            iCloud backup, if you use one). This information never reaches us, and
            it is removed when you delete the app.
          </p>
        </Section>

        <Section title="Location">
          <p>
            If you open the constituency map, the app may use your device location
            to show where you are on the map. This happens entirely on your device
            — your location is never collected, stored, or shared.
          </p>
        </Section>

        <Section title="Parliament data">
          <p>
            Hansard displays public information from the UK Parliament APIs and
            postcodes.io. When you are online, the app requests that public data
            directly from those services. It sends no personal information beyond
            what an ordinary web request includes — for example, a postcode you
            type in to find your MP.
          </p>
        </Section>

        <Section title="Notifications">
          <p>
            Notifications are optional. If you turn them on, the app checks
            Parliament&apos;s public APIs in the background for activity by the MPs
            you follow, and your choices are stored on your device.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Because the app collects no personal data and shows no advertising, it
            does not knowingly gather information from children or anyone else.
          </p>
        </Section>

        <Section title="Your choices and deletion">
          <p>
            Since we hold no personal data about you, there is nothing for us to
            access, correct, or delete. Data stored on your device is removed by
            deleting the app.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes, we will post the updated version on this page
            with a new effective date.
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
              href="/hansard"
              className="text-sm text-muted/60 hover:text-foreground transition-colors"
            >
              ← Back to Hansard
            </Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
