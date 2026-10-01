import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CopyButton, Skeleton } from "@/components/kit";

// Shape of GET /api/auth/me — the only self-service settings source.
export interface Me {
  id: string;
  name: string;
  email: string;
  role: "admin" | "intern";
  companyId: string | null;
  publicProfileEnabled: boolean;
  publicProfileSlug: string | null;
  completionBadgeAwardedAt: string | null;
  morningDigestEnabled: boolean;
}
export const ME_KEY = ["/api/auth/me"] as const;

export function SectionHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// A panel of rows. Rows are separated by hairlines; an optional footer
// carries the fine print.
export function Group({ title, description, children, footer, className, tone = "default" }: { title?: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string; tone?: "default" | "danger" }) {
  return (
    <section className={cn("panel overflow-hidden", tone === "danger" && "border-danger/25", className)}>
      {(title || description) && (
        <div className="px-4 pt-3.5 pb-2.5">
          {title && <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>}
          {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{description}</p>}
        </div>
      )}
      <div className={cn("divide-y divide-line", (title || description) && "border-t border-line")}>{children}</div>
      {footer && <div className="border-t border-line bg-surface-2 px-4 py-2.5 text-[12px] leading-relaxed text-ink-3">{footer}</div>}
    </section>
  );
}

// Label + description on the left, control on the right. Stacks under sm.
export function Row({ label, description, control, htmlFor, children, className }: { label: ReactNode; description?: ReactNode; control?: ReactNode; htmlFor?: string; children?: ReactNode; className?: string }) {
  const Title = htmlFor ? "label" : "p";
  return (
    <div className={cn("px-4 py-3.5", className)}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <Title {...(htmlFor ? { htmlFor } : {})} className="block text-[13.5px] font-medium text-ink">{label}</Title>
          {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{description}</p>}
        </div>
        {control && <div className="flex shrink-0 items-center gap-2 sm:justify-end">{control}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function Value({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <span className={cn("text-[13.5px] text-ink", mono && "t-num")}>{children}</span>;
}

export function Toggle({ id, checked, onCheckedChange, pending = false, disabled = false, "aria-label": ariaLabel }: { id?: string; checked: boolean; onCheckedChange: (v: boolean) => void; pending?: boolean; disabled?: boolean; "aria-label"?: string }) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled || pending}
      aria-label={ariaLabel}
      aria-busy={pending || undefined}
      className={cn(
        "relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "data-[state=checked]:bg-accent data-[state=unchecked]:bg-line-strong",
      )}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-[18px] w-[18px] translate-x-0.5 rounded-full bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-transform duration-150 ease-out data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

export function Field({ label, htmlFor, hint, children, className }: { label: ReactNode; htmlFor: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-2">{label}</Label>
      {children}
      {hint && <p className="text-[11.5px] text-ink-4">{hint}</p>}
    </div>
  );
}

// A shareable URL with copy + open. Full URL so it can be pasted anywhere.
export function LinkBox({ path, label }: { path: string; label: string }) {
  const url = `${window.location.origin}${path}`;
  return (
    <div className="flex h-9 min-w-0 items-center gap-1 rounded-md border border-line bg-bg-sunken pl-3 pr-1">
      <code className="t-num min-w-0 flex-1 truncate text-[12.5px] text-ink-2" title={url}>{url}</code>
      <CopyButton value={url} label={`Copy ${label}`} size="icon-sm" />
      <Button asChild variant="ghost" size="icon-sm"><a href={path} target="_blank" rel="noreferrer" aria-label={`Open ${label} in a new tab`}><ExternalLink className="h-3.5 w-3.5" /></a></Button>
    </div>
  );
}

export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-6 px-4 py-3.5">
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-56 max-w-full" /></div>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}
