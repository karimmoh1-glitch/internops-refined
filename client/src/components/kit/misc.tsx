import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { relativeTime, formatDateTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Check, Copy } from "lucide-react";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 min-w-[20px] items-center justify-center rounded-sm border border-line bg-surface-2 px-1 font-mono text-[10.5px] font-medium text-ink-3", className)}>{children}</kbd>;
}

export function RelativeTime({ value, className, live = true }: { value: string | Date | null | undefined; className?: string; live?: boolean }) {
  const now = useNow(live ? 30_000 : 3_600_000);
  if (!value) return null;
  return <time dateTime={new Date(value).toISOString()} title={formatDateTime(value)} className={cn("whitespace-nowrap", className)}>{relativeTime(value, now)}</time>;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive = false, onConfirm, pending = false }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode; confirmLabel?: string; destructive?: boolean; onConfirm: () => void | Promise<void>; pending?: boolean }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant={destructive ? "destructive" : "default"} disabled={pending} onClick={(e) => { e.preventDefault(); void onConfirm(); }}>{pending ? "Working…" : confirmLabel}</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CopyButton({ value, label = "Copy", className, size = "sm" }: { value: string; label?: string; className?: string; size?: "sm" | "xs" | "icon-sm" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size={size} className={className} aria-label={label} onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}>
      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
      {size !== "icon-sm" && (copied ? "Copied" : label)}
    </Button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, size = "sm" }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-md bg-bg-sunken p-0.5 border border-line", className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn("inline-flex items-center gap-1.5 rounded-[5px] px-2.5 font-medium transition-colors whitespace-nowrap", size === "sm" ? "h-7 text-xs" : "h-8 text-[13px]", value === o.value ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink-3 hover:text-ink")}>
          {o.label}
          {o.count !== undefined && <span className={cn("t-num text-[10.5px]", value === o.value ? "text-ink-3" : "text-ink-4")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]", className)}>
      {items.map((it) => (
        <div key={it.label} className="contents">
          <dt className="text-ink-3">{it.label}</dt>
          <dd className="min-w-0 text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LiveClock({ since, className }: { since: string | Date; className?: string }) {
  const now = useNow(1000);
  const secs = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 1000));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return <span className={cn("t-num", className)}>{h > 0 && `${h}:`}{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}
