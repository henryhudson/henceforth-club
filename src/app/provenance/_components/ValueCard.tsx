import type { ValueIconKey } from "../content";
import ValueIcon from "./ValueIcon";

export default function ValueCard({
  icon,
  title,
  body,
}: {
  icon: ValueIconKey;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm transition hover:border-card-border-hover hover:shadow-md">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#7cce2a]/15 text-[#330a49]">
        <ValueIcon name={icon} />
      </div>
      <h3 className="text-lg font-extrabold text-[#330a49]">{title}</h3>
      <p className="mt-2 leading-relaxed text-muted">{body}</p>
    </div>
  );
}
