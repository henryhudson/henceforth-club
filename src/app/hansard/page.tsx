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

function ParliamentChart() {
  // Generate seats in semicircular arcs — like the House of Commons chamber
  // Each row is an arc from π to 0 (left to right), seats evenly spaced
  const rows = [
    { radius: 60, seats: 12 },
    { radius: 75, seats: 15 },
    { radius: 90, seats: 18 },
    { radius: 105, seats: 21 },
    { radius: 120, seats: 24 },
    { radius: 135, seats: 27 },
    { radius: 150, seats: 30 },
    { radius: 165, seats: 33 },
    { radius: 180, seats: 36 },
    { radius: 195, seats: 39 },
  ];

  // Party colours — roughly proportional to 2024 Commons
  const parties = [
    { color: "#E4003B", count: 411 }, // Labour
    { color: "#0087DC", count: 121 }, // Conservative
    { color: "#FDBB30", count: 72 },  // Lib Dem
    { color: "#FDF38E", count: 9 },   // SNP
    { color: "#005B54", count: 4 },   // Plaid Cymru
    { color: "#2AA82A", count: 4 },   // Green
    { color: "#8b949e", count: 34 },  // Other / Independent
  ];

  // Build a flat array of colours, then assign to seats
  const seatColours: string[] = [];
  for (const p of parties) {
    for (let i = 0; i < p.count; i++) seatColours.push(p.color);
  }

  const totalSeats = rows.reduce((sum, r) => sum + r.seats, 0);
  // Scale party counts to fit total seats
  const ratio = totalSeats / seatColours.length;

  const cx = 200; // centre x
  const cy = 210; // centre y (bottom of semicircle)

  let seatIndex = 0;
  const dots: { x: number; y: number; fill: string }[] = [];

  for (const row of rows) {
    for (let i = 0; i < row.seats; i++) {
      const angle = Math.PI - (i / (row.seats - 1)) * Math.PI;
      const x = cx + row.radius * Math.cos(angle);
      const y = cy - row.radius * Math.sin(angle);
      const colourIdx = Math.min(
        Math.floor(seatIndex / ratio),
        seatColours.length - 1
      );
      dots.push({ x, y, fill: seatColours[colourIdx] });
      seatIndex++;
    }
  }

  return (
    <div className="flex justify-center py-8 sm:py-12">
      <svg
        viewBox="0 0 400 240"
        className="w-72 sm:w-96 h-auto drop-shadow-[0_0_30px_rgba(61,168,122,0.15)]"
        aria-label="House of Commons seating chart coloured by party"
      >
        {dots.map((dot, i) => (
          <circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={3}
            fill={dot.fill}
            opacity={0.85}
          />
        ))}
        {/* Speaker's chair */}
        <rect x={196} y={218} width={8} height={12} rx={1} fill="#3da87a" opacity={0.6} />
        {/* Legend */}
        <g transform="translate(70, 230)" fill="#8b949e">
          <circle cx={0} cy={0} r={3} fill="#E4003B" />
          <text x={6} y={3} fontSize="7" fill="#8b949e">Lab</text>
          <circle cx={38} cy={0} r={3} fill="#0087DC" />
          <text x={44} y={3} fontSize="7" fill="#8b949e">Con</text>
          <circle cx={76} cy={0} r={3} fill="#FDBB30" />
          <text x={82} y={3} fontSize="7" fill="#8b949e">LD</text>
          <circle cx={106} cy={0} r={3} fill="#FDF38E" />
          <text x={112} y={3} fontSize="7" fill="#8b949e">SNP</text>
          <circle cx={142} cy={0} r={3} fill="#005B54" />
          <text x={148} y={3} fontSize="7" fill="#8b949e">PC</text>
          <circle cx={172} cy={0} r={3} fill="#2AA82A" />
          <text x={178} y={3} fontSize="7" fill="#8b949e">Grn</text>
          <circle cx={208} cy={0} r={3} fill="#8b949e" />
          <text x={214} y={3} fontSize="7" fill="#8b949e">Oth</text>
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

        {/* Parliament seating chart */}
        <FadeIn delay={0.15}>
          <div className="mt-8">
            <ParliamentChart />
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
