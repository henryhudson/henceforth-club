import Image from "next/image";
import { ACCREDITATIONS } from "../content";

export default function AccreditationRow() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      {ACCREDITATIONS.map((a) => (
        <div
          key={a.name}
          className="relative h-20 w-32 rounded-xl border border-card-border bg-white shadow-sm"
        >
          <Image src={a.logo} alt={a.name} fill sizes="128px" className="object-contain p-4" />
        </div>
      ))}
    </div>
  );
}
