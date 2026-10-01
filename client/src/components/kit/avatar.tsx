import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

// Deterministic, restrained palette: six muted hues keyed by name so the
// same person always gets the same color across the product.
const HUES = ["bg-accent-soft text-accent", "bg-work-soft text-work", "bg-pulse-soft text-pulse", "bg-warn-soft text-warn", "bg-info-soft text-info", "bg-ok-soft text-ok"];
function hue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

const SIZES = { xs: "h-5 w-5 text-[9px]", sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm", xl: "h-14 w-14 text-lg" };

export function Avatar({ name, size = "md", className, working = false }: { name: string; size?: keyof typeof SIZES; className?: string; working?: boolean }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none", SIZES[size], hue(name), className)} aria-hidden>
      {initials(name)}
      {working && <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-work ring-2 ring-surface" />}
    </span>
  );
}

export function AvatarStack({ names, max = 4, size = "sm" }: { names: string[]; max?: number; size?: keyof typeof SIZES }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((n) => <Avatar key={n} name={n} size={size} className="ring-2 ring-surface" />)}
      {rest > 0 && <span className={cn("inline-flex items-center justify-center rounded-full bg-surface-2 text-ink-3 font-medium ring-2 ring-surface", SIZES[size])}>+{rest}</span>}
    </span>
  );
}
