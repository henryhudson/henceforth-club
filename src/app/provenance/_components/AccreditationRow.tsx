import Image from "next/image";
import { ACCREDITATIONS } from "../content";

export default function AccreditationRow() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      {ACCREDITATIONS.map((a) => (
        <div
          key={a.name}
          className="relative h-28 w-44 rounded-xl border border-card-border bg-white shadow-sm"
        >
          <Image src={a.logo} alt={a.name} fill sizes="176px" className="object-contain p-5" />
        </div>
      ))}
    </div>
  );
}
