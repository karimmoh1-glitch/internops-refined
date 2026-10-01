import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { dueLabel } from "@/lib/format";
import { StatusIcon, PriorityMark, Pill, Avatar } from "@/components/kit";

export interface TaskLite { id: string; title: string; status: string; priority: string; dueDate?: string | null; assigneeName?: string; assigneeId?: string; blockedReason?: string | null; projectId?: string | null }

// One compact, linkable task row used across Home, People, and Projects.
export function TaskRow({ task, showAssignee = false, className, trailing }: { task: TaskLite; showAssignee?: boolean; className?: string; trailing?: React.ReactNode }) {
  const due = dueLabel(task.dueDate, task.status);
  return (
    <Link href={`/tasks/${task.id}`} className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 row-hover min-w-0", className)}>
      <StatusIcon status={task.status} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-ink">{task.title}</span>
        {task.blockedReason && <span className="block truncate text-xs text-danger">{task.blockedReason}</span>}
      </span>
      {showAssignee && task.assigneeName && <span className="hidden sm:flex items-center gap-1.5 text-xs text-ink-3 shrink-0"><Avatar name={task.assigneeName} size="xs" />{task.assigneeName.split(" ")[0]}</span>}
      {due && <Pill tone={due.tone === "muted" ? "neutral" : due.tone} className="shrink-0">{due.text}</Pill>}
      <PriorityMark priority={task.priority} className="shrink-0" />
      {trailing}
    </Link>
  );
}
