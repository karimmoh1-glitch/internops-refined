import { Link } from "wouter";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Avatar, Pill, ProgressBar, RelativeTime, projectStatusTone } from "@/components/kit";
import { planVersionTone, type Project, type Role, type TaskStats } from "./types";

export function ProjectRow({ project, ownerName, stats, role, onApprove, onReject, approving }: {
  project: Project; ownerName: string; stats?: TaskStats; role: Role; onApprove?: (p: Project) => void; onReject?: (p: Project) => void; approving?: boolean;
}) {
  const st = projectStatusTone(project.status);
  const isProposal = project.status === "pending_approval";
  const latest = project.latestVersion ?? null;
  const planTone = latest ? planVersionTone(latest.status) : null;

  return (
    <li className="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 row-hover">
      <Avatar name={ownerName} size="md" className="hidden sm:inline-flex" />
      <div className="min-w-0 flex-1 basis-[240px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/projects/${project.id}`} className="min-w-0 truncate text-[13.5px] font-medium text-ink after:absolute after:inset-0 after:content-['']">{project.title}</Link>
          <Pill tone={st.tone}>{st.label}</Pill>
          {planTone && !isProposal && <span className="text-xs text-ink-3">Plan v{latest!.versionNumber} · {planTone.label.toLowerCase()}</span>}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-3">
          {role === "admin" ? <Link href={`/people/${project.internId}`} className="relative z-10 hover:text-ink hover:underline underline-offset-2">{ownerName}</Link> : ownerName}
          <span aria-hidden> · </span><span className="t-num">{project.minimumTotalHours}h min</span>
          {project.createdAt && <><span aria-hidden> · </span><RelativeTime value={project.createdAt} live={false} /></>}
          {isProposal && <><span aria-hidden> · </span><span className="text-ink-2">{project.idea}</span></>}
        </p>
      </div>

      {!isProposal && stats && (
        <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[150px] sm:max-w-[200px] sm:flex-1" title={`${stats.done} of ${stats.total} tasks approved`}>
          {stats.total > 0 ? (
            <>
              <ProgressBar value={stats.done} max={stats.total} tone={stats.overdue > 0 ? "danger" : stats.done === stats.total ? "ok" : "accent"} className="flex-1" />
              <span className="t-num shrink-0 text-xs text-ink-3">{stats.done}/{stats.total}</span>
              {stats.overdue > 0 && <span className="t-num shrink-0 text-xs text-danger">{stats.overdue} late</span>}
            </>
          ) : <span className="text-xs text-ink-4">No tasks</span>}
        </div>
      )}

      {isProposal && role === "admin" && onApprove && onReject && (
        <div className="relative z-10 flex items-center gap-1.5">
          <Button size="xs" variant="outline" onClick={() => onReject(project)} aria-label={`Decline ${project.title}`}><X className="h-3.5 w-3.5" />Decline</Button>
          <Button size="xs" onClick={() => onApprove(project)} disabled={approving} aria-label={`Approve ${project.title}`}><Check className="h-3.5 w-3.5" />Approve</Button>
        </div>
      )}
      {isProposal && role === "intern" && <span className="text-xs text-ink-3">Waiting for review</span>}
      {project.status === "rejected" && project.rejectionReason && <span className={cn("w-full text-xs text-ink-3 sm:w-auto sm:max-w-[260px] truncate")} title={project.rejectionReason}>Reason: {project.rejectionReason}</span>}
      {!isProposal && !stats && project.logCount !== undefined && <span className="t-num text-xs text-ink-3">{pluralize(project.logCount, "log")}</span>}
    </li>
  );
}
