import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Henceforth — Privacy Policy",
  description:
    "The privacy policy for Henceforth, the FORTH interpreter and Bitcoin SV wallet. Keys stay on your device.",
  alternates: { canonical: "/henceforth/privacy" },
};

const EFFECTIVE_DATE = "19 July 2026";

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

export default function HenceforthPrivacyPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <p className="text-xs tracking-widest text-accent-warm/70 uppercase">
            Henceforth · Legal
          </p>
          <h1 className="mt-6 text-5xl sm:text-6xl text-foreground font-bold">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm tracking-wide text-muted/60">
            Effective {EFFECTIVE_DATE}
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="card-glow card-glow-warm mt-10 rounded-2xl border border-card-border bg-card-bg/50 p-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-warm/80">
              Short version
            </p>
            <p className="mt-3 text-muted leading-relaxed">
              <strong className="text-foreground font-medium">
                Private keys and seed phrases never leave your device.
              </strong>{" "}
              Henceforth does not run advertising or third-party analytics
              SDKs. Wallet state lives in the Keychain and local storage;
              blockchain network calls go to the services needed to send and
              verify transactions. Purchases are handled by Apple.
            </p>
          </div>
        </FadeIn>

        <Section title="Who we are">
          <p>
            Henceforth is an iOS and macOS app published by{" "}
            <strong className="text-foreground font-medium">
              Henceforth Bitcoin Limited
            </strong>{" "}
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains how the
            app handles information.
          </p>
        </Section>

        <Section title="Data we collect">
          <p>
            We do not operate user accounts for Henceforth. We do not sell
            personal data. We do not run advertising networks or third-party
            analytics SDKs inside the app.
          </p>
          <p>
            Aggregate, non-identifying App Store sales reporting is provided by
            Apple. Optional site visitor counting on henceforth.club is separate
            from the app and is described only as far as this site is concerned.
          </p>
        </Section>

        <Section title="Data on your device">
          <p>
            Seed phrases, private keys, and wallet secrets are stored in the
            device Keychain, protected by the Secure Enclave where available.
            Transaction history, UTXO caches, preferences, and user-defined
            FORTH files may be stored on device and, if you enable it, in your
            iCloud Drive for backup across your own devices.
          </p>
          <p>
            Deleting the app removes local app data. Keychain items follow Apple
            Keychain rules for that device and account.
          </p>
        </Section>

        <Section title="Network services">
          <p>
            To send and receive Bitcoin SV, the app contacts blockchain
            infrastructure — for example chain indexers for history and unspent
            outputs, miner-facing broadcast endpoints, and related APIs. Those
            requests carry the addresses and transaction data required for the
            operation you initiated. We do not control those third-party
            operators; their own policies apply to traffic they receive.
          </p>
        </Section>

        <Section title="Purchases (Apple StoreKit)">
          <p>
            Henceforth is sold through the App Store. Apple processes payment
            via StoreKit. We never receive or store your payment card details.
          </p>
          <p>
            Purchases are covered by{" "}
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

        <Section title="Children">
          <p>
            The app is not directed at children. We do not knowingly collect
            personal data from children.
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
              href="/henceforth"
              className="text-sm text-muted/60 hover:text-foreground transition-colors"
            >
              ← Back to Henceforth
            </Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
