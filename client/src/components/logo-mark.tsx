/**
 * The InternOps mark: a pulse/heartbeat line on a deep violet rounded
 * square. Represents the living activity of an org — tasks, messages,
 * check-ins — as a single continuous signal. client/public/favicon.svg is
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
      <rect width="64" height="64" rx="16" fill="#12101C" />
      <path
        d="M10 34 H21 L26 22 L34 46 L39 30 L43 34 H54"
        stroke="#6D5EF5"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="43" cy="34" r="4" fill="#8B7FF7" />
    </svg>
  );
}
