/**
 * The InternOps mark: an ink tile with a bright "signal" bar — the one
 * live thing on an otherwise quiet surface. client/public/favicon.svg is
 * generated from this geometry; keep both in sync.
 */
export default function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={`shrink-0 ${className}`} role="img" aria-label="InternOps">
      <rect width="64" height="64" rx="14" fill="#17161A" />
      <rect x="14" y="40" width="36" height="8" rx="4" fill="#FFFFFF" fillOpacity="0.92" />
      <rect x="14" y="28" width="24" height="8" rx="4" fill="#FFFFFF" fillOpacity="0.55" />
      <rect x="14" y="16" width="14" height="8" rx="4" fill="#5B86FF" />
    </svg>
  );
}

export function Wordmark({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`font-semibold tracking-[-0.02em] text-ink ${className}`} style={{ fontSize: size }}>
      InternOps
    </span>
  );
}
