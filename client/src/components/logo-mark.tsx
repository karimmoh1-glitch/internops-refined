/**
 * The InternOps icon mark: three ascending rounded bars on a coral
 * gradient square, standing in for progress/growth — an intern's work
 * building up over time. Used everywhere the old "coral square with the
 * letter I" placeholder was, plus the favicon (client/public/favicon.svg
 * is generated from the same geometry — keep them in sync if this changes).
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
      <defs>
        <linearGradient id="internops-logo-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#EF7878" />
          <stop offset="1" stopColor="#e05555" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#internops-logo-gradient)" />
      <rect x="14" y="34" width="8" height="16" rx="3" fill="white" />
      <rect x="28" y="26" width="8" height="24" rx="3" fill="white" />
      <rect x="42" y="18" width="8" height="32" rx="3" fill="white" />
    </svg>
  );
}
