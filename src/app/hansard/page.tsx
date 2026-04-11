import type { Metadata } from "next";
import Image from "next/image";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Hansard",
  description:
    "Browse UK Parliament — Members of the Commons, House of Lords, and constituencies with an interactive map. A native iOS app.",
};

const features = [
  {
    icon: "🏛",
    title: "Members of the Commons",
    description:
      "Browse and search every sitting MP. View party affiliation, constituency, contact details, and portrait — all from the official Parliament API.",
  },
  {
    icon: "👑",
    title: "House of Lords",
    description:
      "Explore the full list of Lords, filtered by party or type. Life peers, hereditary peers, and bishops — all searchable and browsable.",
  },
  {
    icon: "🗺",
    title: "Constituency Map",
    description:
      "An interactive MapKit map with every UK constituency boundary drawn as a polygon overlay, coloured by the sitting member's political party.",
  },
  {
    icon: "📡",
    title: "Offline-First",
    description:
      "Bundled JSON snapshots of constituency boundaries and member data. The app works immediately on first launch — no network required.",
  },
  {
    icon: "🗳",
    title: "Voting History",
    description:
      "View how members voted in parliamentary divisions. Filter by date, topic, or member to see voting records at a glance.",
  },
  {
    icon: "📝",
    title: "Written Questions",
    description:
      "Browse parliamentary written questions and answers. Search by topic, member, or department to follow the detail of governance.",
  },
];

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="card-glow card-glow-green rounded-xl border border-card-border bg-card-bg/50 p-6 hover:border-card-border-hover transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}

function ConstituencyMap() {
  return (
    <div className="flex justify-center py-8 sm:py-12">
      <svg
        viewBox="0 0 300 480"
        className="w-48 sm:w-64 h-auto drop-shadow-[0_0_30px_rgba(61,168,122,0.15)]"
        aria-label="Stylised UK constituency map"
      >
        {/* Scotland */}
        <g opacity="0.9">
          {/* Highlands - SNP yellow */}
          <path d="M130 20 L170 15 L185 35 L190 65 L175 80 L155 75 L140 55 Z" fill="#FDF38E" stroke="#1a2332" strokeWidth="1" />
          {/* Central Scotland - SNP */}
          <path d="M140 55 L155 75 L175 80 L180 100 L165 115 L145 110 L135 90 Z" fill="#FDF38E" stroke="#1a2332" strokeWidth="1" />
          {/* Edinburgh area - mixed */}
          <path d="M145 110 L165 115 L175 125 L168 140 L150 138 L140 125 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* Glasgow area - Labour */}
          <path d="M125 95 L140 90 L145 110 L140 125 L125 120 L118 108 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* Borders */}
          <path d="M140 125 L150 138 L168 140 L172 155 L155 162 L135 155 L128 140 Z" fill="#FDF38E" stroke="#1a2332" strokeWidth="1" />
          {/* NE Scotland */}
          <path d="M175 80 L190 65 L200 75 L195 95 L180 100 Z" fill="#FDF38E" stroke="#1a2332" strokeWidth="1" />
        </g>

        {/* Northern England */}
        <g opacity="0.9">
          {/* Northumberland */}
          <path d="M155 162 L172 155 L180 165 L178 185 L165 190 L150 180 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* Tyneside / Durham */}
          <path d="M150 180 L165 190 L178 185 L182 205 L170 215 L155 210 L145 195 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* Cumbria */}
          <path d="M120 175 L135 170 L145 185 L145 205 L130 210 L115 195 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* Yorkshire */}
          <path d="M145 205 L155 210 L170 215 L185 220 L190 240 L175 250 L155 248 L140 235 L135 218 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* Lancashire */}
          <path d="M115 195 L130 210 L135 218 L140 235 L128 245 L112 235 L108 215 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
        </g>

        {/* Midlands */}
        <g opacity="0.9">
          {/* East Midlands - mixed */}
          <path d="M155 248 L175 250 L190 260 L188 280 L172 290 L158 285 L148 270 Z" fill="#0087DC" stroke="#1a2332" strokeWidth="1" />
          {/* West Midlands - Labour */}
          <path d="M128 245 L140 235 L155 248 L148 270 L140 280 L125 275 L118 258 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* Birmingham */}
          <path d="M140 280 L148 270 L158 285 L155 300 L142 305 L132 295 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* East Anglia - Conservative */}
          <path d="M188 280 L205 275 L218 285 L215 305 L200 310 L188 300 Z" fill="#0087DC" stroke="#1a2332" strokeWidth="1" />
        </g>

        {/* South */}
        <g opacity="0.9">
          {/* Home Counties - Conservative */}
          <path d="M155 300 L172 290 L188 300 L200 310 L195 330 L180 340 L160 335 L148 320 Z" fill="#0087DC" stroke="#1a2332" strokeWidth="1" />
          {/* London - Labour */}
          <path d="M165 335 L180 340 L192 345 L188 360 L175 365 L162 358 L158 345 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* South West */}
          <path d="M100 340 L118 330 L132 335 L142 345 L138 365 L120 375 L105 370 L92 355 Z" fill="#FDBB30" stroke="#1a2332" strokeWidth="1" />
          {/* Cornwall */}
          <path d="M70 365 L92 355 L105 370 L100 390 L85 400 L68 395 L60 380 Z" fill="#FDBB30" stroke="#1a2332" strokeWidth="1" />
          {/* South East - Conservative */}
          <path d="M160 335 L148 320 L142 305 L132 295 L125 310 L118 330 L132 335 L142 345 L158 345 Z" fill="#0087DC" stroke="#1a2332" strokeWidth="1" />
          {/* Kent */}
          <path d="M188 360 L192 345 L205 340 L215 350 L210 370 L195 375 Z" fill="#0087DC" stroke="#1a2332" strokeWidth="1" />
          {/* Hampshire */}
          <path d="M138 365 L158 345 L162 358 L175 365 L170 380 L152 388 L135 385 Z" fill="#0087DC" stroke="#1a2332" strokeWidth="1" />
          {/* Devon */}
          <path d="M85 400 L100 390 L120 375 L130 385 L125 405 L108 415 L90 410 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
        </g>

        {/* Wales */}
        <g opacity="0.9">
          {/* North Wales */}
          <path d="M90 230 L108 225 L112 235 L115 250 L105 260 L88 255 L82 242 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
          {/* Mid Wales - Plaid */}
          <path d="M88 255 L105 260 L110 275 L105 295 L90 300 L78 290 L75 270 Z" fill="#005B54" stroke="#1a2332" strokeWidth="1" />
          {/* South Wales - Labour */}
          <path d="M90 300 L105 295 L118 305 L118 330 L100 340 L85 330 L80 315 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="1" />
        </g>

        {/* Northern Ireland (inset) */}
        <g opacity="0.7" transform="translate(20, 160)">
          <rect x="0" y="0" width="55" height="40" rx="3" fill="none" stroke="#2d3748" strokeWidth="0.5" strokeDasharray="2,2" />
          <path d="M8 8 L25 5 L40 10 L42 25 L30 32 L15 30 L5 20 Z" fill="#E4003B" stroke="#1a2332" strokeWidth="0.8" />
          <path d="M25 5 L40 10 L48 8 L50 20 L42 25 Z" fill="#D46A4C" stroke="#1a2332" strokeWidth="0.8" />
        </g>

        {/* Map legend */}
        <g transform="translate(15, 430)" className="text-[7px]" fill="#8b949e">
          <rect x="0" y="0" width="8" height="8" rx="1" fill="#E4003B" />
          <text x="12" y="7" fontSize="7">Lab</text>
          <rect x="40" y="0" width="8" height="8" rx="1" fill="#0087DC" />
          <text x="52" y="7" fontSize="7">Con</text>
          <rect x="80" y="0" width="8" height="8" rx="1" fill="#FDF38E" />
          <text x="92" y="7" fontSize="7">SNP</text>
          <rect x="120" y="0" width="8" height="8" rx="1" fill="#FDBB30" />
          <text x="132" y="7" fontSize="7">LD</text>
          <rect x="160" y="0" width="8" height="8" rx="1" fill="#005B54" />
          <text x="172" y="7" fontSize="7">PC</text>
        </g>
      </svg>
    </div>
  );
}

export default function HansardPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <FadeIn>
          <div className="max-w-3xl">
            <p className="text-xs tracking-widest text-accent-green/70 uppercase">
              iOS App
            </p>
            <h1 className="mt-6 text-5xl sm:text-7xl text-foreground font-bold">
              Hansard
            </h1>
            <p className="mt-3 text-sm tracking-wide text-accent-green/70">
              See how they treat you.
            </p>
            <p className="mt-6 text-lg leading-relaxed text-muted max-w-2xl">
              Browse{" "}
              <strong className="text-foreground font-medium">
                UK Parliament
              </strong>{" "}
              — Members of the Commons, House of Lords, and constituencies with
              an{" "}
              <strong className="text-foreground font-medium">
                interactive map
              </strong>
              , running natively on your iPhone and iPad.
            </p>
          </div>
        </FadeIn>

        {/* Constituency map centrepiece */}
        <FadeIn delay={0.15}>
          <div className="mt-8">
            <ConstituencyMap />
          </div>
        </FadeIn>

        {/* Features grid */}
        <div className="mt-16">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs tracking-widest text-muted/50 uppercase">
              Features
            </p>
          </FadeIn>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <FadeIn key={feature.title} delay={i * 0.08}>
                <FeatureCard {...feature} />
              </FadeIn>
            ))}
          </div>
        </div>

        {/* CTA */}
        <FadeIn>
          <div className="mt-24 text-center">
            <div className="section-line mb-12" />
            <Image
              src="/icons/hansard.png"
              alt="Hansard app icon"
              width={80}
              height={80}
              className="mx-auto mb-6 rounded-2xl shadow-lg shadow-accent-green/10"
            />
            <p className="text-xs text-muted/50 mb-6 tracking-wider uppercase">
              Coming soon
            </p>
            <span className="inline-flex items-center gap-3 rounded-full border border-card-border bg-card-bg/50 px-8 py-4 text-sm text-muted/50 cursor-default">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Coming Soon to the App Store
            </span>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
