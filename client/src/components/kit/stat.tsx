import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { type Tone, toneClasses } from "./status";

export function Stat({ label, value, hint, tone = "neutral", href, icon, className }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; href?: string; icon?: ReactNode; className?: string }) {
  const body = (
    <div className={cn("flex flex-col gap-1.5 rounded-lg px-3.5 py-3 border border-line bg-surface transition-colors", href && "hover:bg-surface-2 cursor-pointer", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="t-label">{label}</span>
        {icon && <span className={cn("[&_svg]:h-3.5 [&_svg]:w-3.5", toneClasses[tone].text)}>{icon}</span>}
      </div>
      <span className={cn("t-num text-2xl font-semibold leading-none", tone !== "neutral" ? toneClasses[tone].text : "text-ink")}>{value}</span>
      {hint && <span className="text-xs text-ink-3 truncate">{hint}</span>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function ProgressBar({ value, max = 100, tone = "accent", className, size = "sm" }: { value: number; max?: number; tone?: Tone; className?: string; size?: "xs" | "sm" | "md" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-bg-sunken", size === "xs" ? "h-1" : size === "md" ? "h-2" : "h-1.5", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", toneClasses[tone].dot)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Metric({ value, unit, className }: { value: ReactNode; unit?: string; className?: string }) {
  return <span className={cn("t-num font-semibold", className)}>{value}{unit && <span className="ml-0.5 text-[0.7em] font-medium text-ink-3">{unit}</span>}</span>;
}
