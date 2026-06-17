import type { ValueIconKey } from "../content";

const PATHS: Record<ValueIconKey, React.ReactNode> = {
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9s1.3-6.6 3.8-9Z" />
    </>
  ),
  handshake: (
    <>
      <path d="M11 17 8.5 14.5" />
      <path d="m3 11 4-4 5 4 2-1 4 3" />
      <path d="m21 11-4 5-3-2" />
      <path d="M3 11v5l3 3" />
      <path d="M21 11v5l-3 3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4 3 7 7 8 4-1 7-4 7-8V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  chart: (
    <>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M17 8h4v4" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13C12 9 9 7 5 7c0 4 3 6 7 6Z" />
      <path d="M12 11c0-3 3-5 7-5 0 3-3 5-7 5Z" />
    </>
  ),
  star: <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z" />,
  bulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3Z" />
    </>
  ),
};

export default function ValueIcon({ name }: { name: ValueIconKey }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
