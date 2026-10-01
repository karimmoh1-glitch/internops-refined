import { cn } from "@/lib/utils";
import { Circle, CircleDot, Eye, Ban, CheckCircle2, ArrowUp, Minus, ArrowDown } from "lucide-react";

export type TaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "completed";
export type Tone = "neutral" | "accent" | "info" | "danger" | "ok" | "warn" | "work" | "pulse";

export const TASK_STATUS_META: Record<TaskStatus, { label: string; tone: Tone; Icon: typeof Circle; order: number }> = {
  todo: { label: "To do", tone: "neutral", Icon: Circle, order: 0 },
  in_progress: { label: "In progress", tone: "accent", Icon: CircleDot, order: 1 },
  in_review: { label: "In review", tone: "info", Icon: Eye, order: 2 },
  blocked: { label: "Blocked", tone: "danger", Icon: Ban, order: 3 },
  completed: { label: "Approved", tone: "ok", Icon: CheckCircle2, order: 4 },
};

export const toneClasses: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  neutral: { text: "text-ink-2", bg: "bg-surface-2", border: "border-line", dot: "bg-ink-4" },
  accent: { text: "text-accent", bg: "bg-accent-soft", border: "border-accent/20", dot: "bg-accent" },
  info: { text: "text-info", bg: "bg-info-soft", border: "border-info/20", dot: "bg-info" },
  danger: { text: "text-danger", bg: "bg-danger-soft", border: "border-danger/20", dot: "bg-danger" },
  ok: { text: "text-ok", bg: "bg-ok-soft", border: "border-ok/20", dot: "bg-ok" },
  warn: { text: "text-warn", bg: "bg-warn-soft", border: "border-warn/20", dot: "bg-warn" },
  work: { text: "text-work", bg: "bg-work-soft", border: "border-work/25", dot: "bg-work" },
  pulse: { text: "text-pulse", bg: "bg-pulse-soft", border: "border-pulse/20", dot: "bg-pulse" },
};

export function Pill({ tone = "neutral", children, className, icon }: { tone?: Tone; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  const t = toneClasses[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 h-[20px] text-[11px] font-medium leading-none whitespace-nowrap", t.text, t.bg, t.border, className)}>
      {icon}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className, iconOnly = false }: { status: string; className?: string; iconOnly?: boolean }) {
  const meta = TASK_STATUS_META[status as TaskStatus] ?? { label: status.replace(/_/g, " "), tone: "neutral" as Tone, Icon: Circle, order: 9 };
  const t = toneClasses[meta.tone];
  if (iconOnly) return <meta.Icon className={cn("h-3.5 w-3.5", t.text, className)} aria-label={meta.label} />;
  return (
    <Pill tone={meta.tone} className={className} icon={<meta.Icon className="h-3 w-3" />}>
      {meta.label}
    </Pill>
  );
}

export function StatusIcon({ status, className }: { status: string; className?: string }) {
  const meta = TASK_STATUS_META[status as TaskStatus];
  const Icon = meta?.Icon ?? Circle;
  return <Icon className={cn("h-4 w-4 shrink-0", meta ? toneClasses[meta.tone].text : "text-ink-4", className)} aria-label={meta?.label ?? status} />;
}

export function PriorityMark({ priority, withLabel = false, className }: { priority: string; withLabel?: boolean; className?: string }) {
  const map: Record<string, { Icon: typeof ArrowUp; cls: string; label: string }> = {
    high: { Icon: ArrowUp, cls: "text-danger", label: "High" },
    medium: { Icon: Minus, cls: "text-warn", label: "Medium" },
    low: { Icon: ArrowDown, cls: "text-ink-4", label: "Low" },
  };
  const m = map[priority] ?? map.medium;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", m.cls, className)} title={`${m.label} priority`}>
      <m.Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {withLabel && m.label}
    </span>
  );
}

export function Dot({ tone = "neutral", pulse = false, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", toneClasses[tone].dot, pulse && "work-ring", className)} />;
}

export function projectStatusTone(status: string): { label: string; tone: Tone } {
  switch (status) {
    case "active": case "approved": return { label: "Active", tone: "ok" };
    case "submitted": return { label: "Plan in review", tone: "info" };
    case "planning": return { label: "Planning", tone: "accent" };
    case "pending_approval": return { label: "Proposal", tone: "warn" };
    case "rejected": return { label: "Rejected", tone: "danger" };
    case "completed": return { label: "Completed", tone: "ok" };
    default: return { label: "Assigned", tone: "neutral" };
  }
}
