import Image from "next/image";
import { ACCREDITATIONS } from "../content";

export default function AccreditationRow() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      {ACCREDITATIONS.map((a) => (
        <div
          key={a.name}
          className="relative h-16 w-28 rounded-xl border border-card-border bg-card-bg"
        >
          <Image
            src={a.logo}
            alt={a.name}
            fill
            sizes="112px"
            className="object-contain p-3 opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0"
          />
        </div>
      ))}
    </div>
  );
}
