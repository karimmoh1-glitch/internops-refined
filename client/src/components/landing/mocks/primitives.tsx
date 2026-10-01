import type { ReactNode } from "react";
import { ListTodo, User, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import LogoMark from "@/components/logo-mark";
import { Avatar, Kbd, LiveClock, Pill } from "@/components/kit";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { SAMPLE_MANAGER, SAMPLE_SESSION_STARTED_AT, type ReplayMarker } from "./sample-data";

// Shared pieces for the landing-page mocks. Everything here is inert: the
// frames are images of the product built from the real kit, not the product.

const NAV = ["Home", "Tasks", "Projects", "Work", "People", "Signals", "Pulse", "Messages"] as const;

/** The app chrome: top bar with nav, search and the signed-in avatar. */
export function AppFrame({ active, label, caption, children, className, bodyClassName }: { active: (typeof NAV)[number]; label: string; caption?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <div role="img" aria-label={label} className="panel lift @container overflow-hidden text-left">
        <div aria-hidden>
          <div className="flex h-10 items-center gap-3 border-b border-line bg-surface px-3">
            <LogoMark size={18} />
            <nav className="hidden @2xl:flex items-center gap-0.5">
              {NAV.map((n) => (
                <span key={n} className={cn("rounded-sm px-2 py-1 text-[11.5px] font-medium leading-none", n === active ? "bg-surface-2 text-ink" : "text-ink-3")}>{n}</span>
              ))}
            </nav>
            <span className="@2xl:hidden text-[12px] font-medium text-ink">{active}</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden @sm:inline-flex h-6 items-center gap-1.5 rounded-sm border border-line bg-bg px-1.5 text-[11px] text-ink-4">
                Search
                <Kbd className="h-4 min-w-[16px] text-[9.5px]">⌘K</Kbd>
              </span>
              <Avatar name={SAMPLE_MANAGER} size="sm" />
            </div>
          </div>
          <div className={cn("bg-bg p-3 @md:p-4", bodyClassName)}>{children}</div>
        </div>
      </div>
      {caption && <figcaption className="t-meta mt-3">{caption}</figcaption>}
    </figure>
  );
}

/** A reference chip exactly as Pulse renders `[[task:ID|label]]`, but inert. */
export function MockChip({ kind, label, className }: { kind: "task" | "person" | "project"; label: string; className?: string }) {
  const Icon = kind === "task" ? ListTodo : kind === "person" ? User : FolderKanban;
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-sm border border-line bg-surface px-1.5 py-px text-[12.5px] font-medium text-ink align-baseline", className)}>
      <Icon className="h-3 w-3 shrink-0 text-ink-3" />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Looks like the product's Button; renders as a span so the mock has no controls. */
export function MockButton({ variant = "default", size = "xs", className, children }: { variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; className?: string; children: ReactNode }) {
  return <span className={cn(buttonVariants({ variant, size }), "pointer-events-none", className)}>{children}</span>;
}

/** The live elapsed clock every Work Mode surface shows. Ticks from the shared sample start. */
export function SampleTimer({ className }: { className?: string }) {
  return <LiveClock since={SAMPLE_SESSION_STARTED_AT} className={className} />;
}

/** The global "Working" chip from the app shell. */
export function WorkingChip({ className, withTimer = true }: { className?: string; withTimer?: boolean }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-2 rounded-md border border-work/30 bg-work-soft px-2.5 text-xs font-medium text-work", className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-work work-ring" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-work" />
      </span>
      Working
      {withTimer && <SampleTimer />}
    </span>
  );
}

const MARKER_TONE = { OBSERVED: "work", SYSTEM: "neutral", UNKNOWN: "warn" } as const;

/** OBSERVED / SYSTEM / UNKNOWN provenance marker used by Workday Replay. */
export function Marker({ kind, className }: { kind: ReplayMarker; className?: string }) {
  return <Pill tone={MARKER_TONE[kind]} className={cn("h-[18px] px-1 text-[9.5px] tracking-[0.08em]", className)}>{kind}</Pill>;
}

/** A single list row inside a panel. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-b-0", className)}>{children}</div>;
}
