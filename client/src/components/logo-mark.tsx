/**
 * The InternOps mark: a single ascending arrow on a dark rounded square,
 * with a coral accent dot at the tip. Deliberately abstract rather than
 * literal (no bar chart, no checkmark) — the same shape scales cleanly
 * from a 16px favicon up to a hero lockup. client/public/favicon.svg is
 * generated from this exact geometry — keep them in sync if this changes.
 */
export default function LogoMark({ size = 32, rounded = "lg" }: { size?: number; rounded?: "md" | "lg" | "xl" }) {
  const radiusClass = rounded === "xl" ? "rounded-xl" : rounded === "md" ? "rounded-md" : "rounded-lg";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${radiusClass} shrink-0`}
      role="img"
      aria-label="InternOps"
    >
      <rect width="64" height="64" rx="15" fill="#14171F" />
      <path
        d="M19 45 L41 23 M41 23 L41 35 M41 23 L29 23"
        stroke="#FAFAF9"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="41" cy="23" r="4.5" fill="#E8604F" />
    </svg>
  );
}
