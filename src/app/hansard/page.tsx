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

function CommonsChamber() {
  // Faithful to the app's CommonsChamberView layout:
  // Two opposing benches of party-coloured squares facing each other
  // across an aisle, Speaker at top, government left, opposition right.
  const sq = 4;
  const gap = 1;
  const pitch = sq + gap;
  const rows = 6;
  const aisleW = 16;
  const topPad = 22;
  const bottomPad = 8;

  // Party seat counts (2024 general election results)
  const parties: [string, number][] = [
    ["#E4003B", 411], // Labour
    ["#0087DC", 121], // Conservative
    ["#FDBB30", 72],  // Lib Dem
    ["#FDF38E", 9],   // SNP
    ["#005B54", 4],   // Plaid Cymru
    ["#2AA82A", 4],   // Green
    ["#D46A4C", 5],   // DUP
    ["#CE4A7E", 7],   // Sinn Féin
    ["#8b949e", 17],  // Other / Independent
  ];

  const colours: string[] = [];
  for (const [c, n] of parties) for (let i = 0; i < n; i++) colours.push(c);

  const cap = 325;
  const gov = colours.slice(0, cap);
  const opp = colours.slice(cap, cap * 2);

  const benchDepth = rows * pitch - gap;
  const chartW = benchDepth * 2 + aisleW;
  const maxCols = Math.ceil(Math.max(gov.length, opp.length) / rows);
  const chartH = topPad + maxCols * pitch - gap + bottomPad;

  const seats: { x: number; y: number; fill: string }[] = [];

  // Government bench (left) — rows fill from aisle outward
  gov.forEach((fill, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    seats.push({
      x: (rows - 1 - row) * pitch,
      y: topPad + col * pitch,
      fill,
    });
  });

  // Opposition bench (right) — rows fill from aisle outward
  opp.forEach((fill, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    seats.push({
      x: benchDepth + aisleW + row * pitch,
      y: topPad + col * pitch,
      fill,
    });
  });

  return (
    <div className="flex justify-center py-8 sm:py-12">
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="h-64 sm:h-80 w-auto drop-shadow-[0_0_30px_rgba(61,168,122,0.15)]"
        aria-label="House of Commons seating chart — 650 seats coloured by party"
        role="img"
      >
        {/* Commons green background */}
        <rect x={0} y={0} width={chartW} height={chartH} rx={3} fill="#004432" />

        {/* Aisle lines */}
        <line x1={benchDepth + 1} y1={topPad - 4} x2={benchDepth + 1} y2={chartH - bottomPad + 2} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
        <line x1={benchDepth + aisleW - 1} y1={topPad - 4} x2={benchDepth + aisleW - 1} y2={chartH - bottomPad + 2} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />

        {/* Speaker */}
        <text
          x={chartW / 2}
          y={12}
          textAnchor="middle"
          fontSize={5}
          fontWeight="bold"
          fill="rgba(255,255,255,0.6)"
          fontFamily="monospace"
        >
          SPEAKER
        </text>

        {/* Seats */}
        {seats.map((s, i) => (
          <rect
            key={i}
            x={s.x}
            y={s.y}
            width={sq}
            height={sq}
            fill={s.fill}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={0.3}
            rx={0.5}
          />
        ))}

        {/* Dispatch boxes (the tables at the front of each bench) */}
        <rect x={benchDepth + 3} y={topPad + 2} width={aisleW - 6} height={3} rx={0.5} fill="rgba(255,255,255,0.12)" />
        <rect x={benchDepth + 3} y={topPad + 8} width={aisleW - 6} height={3} rx={0.5} fill="rgba(255,255,255,0.12)" />
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

        {/* Parliament seating chart */}
        <FadeIn delay={0.15}>
          <div className="mt-8">
            <CommonsChamber />
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
