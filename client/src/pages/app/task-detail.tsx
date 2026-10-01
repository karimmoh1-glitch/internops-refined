import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Play, Send, Ban, Undo2, Check, Pencil, Trash2, MessageSquare, History, Monitor, ChevronRight, Circle, CircleDot, Eye, CheckCircle2, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDuration, dueLabel, formatDate, pluralize } from "@/lib/format";
import { Page, PageHeader, Section, SectionLabel, EmptyState, ErrorState, Skeleton, StatusBadge, PriorityMark, Pill, Avatar, Timeline, TimelineItem, KeyValue, RelativeTime, ConfirmDialog, projectStatusTone, type TaskStatus } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { SubmitDialog, BlockDialog, ReviewDialog } from "@/components/tasks/TaskActionDialogs";
import { useTaskMutations } from "@/components/tasks/useTaskMutations";

interface Detail {
  task: { id: string; title: string; description: string | null; status: TaskStatus; priority: string; assigneeId: string; projectId: string | null; dueDate: string | null; blockedReason: string | null; feedback: string | null; submission: string | null; submittedAt: string | null; completedAt: string | null; startedAt: string | null; createdAt: string; updatedAt: string; skillTags: string[]; dependsOnTaskId: string | null };
  assignee: { id: string; name: string; role: string } | null;
  creator: { id: string; name: string } | null;
  project: { id: string; title: string; status: string } | null;
  submissions: { id: string; submission: string; submittedAt: string }[];
  comments: { id: string; content: string; createdAt: string; authorName: string | null; authorRole: string | null; authorUserId: string | null }[];
  evidence: { totalSeconds: number; sessions: { id: string; startedAt: string; endedAt: string | null; seconds: number }[]; segments: { startedAt: string; endedAt: string; durationSeconds: number; label: string; application: string; category: string; contextStatus: string }[] };
  history: { ts: string; kind: string; label: string; by?: string }[];
  dependents: { id: string; title: string; status: string }[];
  upstream: { id: string; title: string; status: string } | null;
}

const STEPS: { key: string; label: string; Icon: typeof Circle }[] = [
  { key: "todo", label: "To do", Icon: Circle },
  { key: "in_progress", label: "In progress", Icon: CircleDot },
  { key: "in_review", label: "In review", Icon: Eye },
  { key: "completed", label: "Approved", Icon: CheckCircle2 },
];
const HISTORY_TONE: Record<string, "neutral" | "accent" | "info" | "danger" | "ok" | "warn" | "pulse"> = { created: "neutral", started: "accent", submitted: "info", changes_requested: "warn", blocked: "danger", approved: "ok", comment: "pulse" };

export default function TaskDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, setLocation] = useLocation();
  const q = useQuery<Detail>({ queryKey: [`/api/tasks/${id}/detail`], refetchInterval: 30_000 });
  const m = useTaskMutations(id);
  const [dialog, setDialog] = useState<"submit" | "block" | "approve" | "changes" | "edit" | "delete" | null>(null);
  const [comment, setComment] = useState("");

  const d = q.data;
  const t = d?.task;
  const isAssignee = !!t && t.assigneeId === user?.id;
  const stepIndex = useMemo(() => (t ? (t.status === "blocked" ? 1 : STEPS.findIndex((s) => s.key === t.status)) : 0), [t]);

  if (q.isLoading) return <Page><div className="pt-8 space-y-4"><Skeleton className="h-4 w-40" /><Skeleton className="h-7 w-2/3" /><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] pt-4"><div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-40" /><Skeleton className="h-32" /></div><Skeleton className="h-72" /></div></div></Page>;
  if (q.error || !d || !t) return <Page><div className="pt-8"><ErrorState title="Task not found" message={(q.error as Error)?.message ?? "It may have been deleted, or you don't have access to it."} onRetry={() => q.refetch()} /><div className="text-center"><Button variant="outline" size="sm" asChild><Link href="/tasks">Back to tasks</Link></Button></div></div></Page>;

  const due = dueLabel(t.dueDate, t.status);
  const latestSubmission = d.submissions[0] ?? null;
  const canAct = isAssignee || (!isAdmin && isAssignee);

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {canAct && t.status === "todo" && <Button onClick={() => m.start.mutate(undefined)} disabled={m.start.isPending}><Play className="h-4 w-4" fill="currentColor" />{m.start.isPending ? "Starting…" : "Start task"}</Button>}
      {canAct && (t.status === "in_progress" || t.status === "blocked") && <Button onClick={() => setDialog("submit")}><Send className="h-4 w-4" />{t.submittedAt ? "Resubmit" : "Submit for review"}</Button>}
      {canAct && t.status === "blocked" && <Button variant="outline" onClick={() => m.unblock.mutate(undefined)} disabled={m.unblock.isPending}><Undo2 className="h-4 w-4" />Unblock</Button>}
      {canAct && (t.status === "todo" || t.status === "in_progress") && <Button variant="outline" onClick={() => setDialog("block")}><Ban className="h-4 w-4" />Blocked</Button>}
      {isAdmin && t.status === "in_review" && <><Button onClick={() => setDialog("approve")}><Check className="h-4 w-4" />Approve</Button><Button variant="outline" onClick={() => setDialog("changes")}><Undo2 className="h-4 w-4" />Request changes</Button></>}
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog("edit")}><Pencil className="h-4 w-4" />Edit</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog("delete")} className="text-danger focus:text-danger"><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <Page width="wide">
      <PageHeader crumbs={[{ label: "Tasks", href: "/tasks" }, ...(d.project ? [{ label: d.project.title, href: `/projects/${d.project.id}` }] : []), { label: t.title }]} title={t.title} actions={actionButtons}>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={t.status} />
          <PriorityMark priority={t.priority} withLabel />
          {due && <Pill tone={due.tone === "muted" ? "neutral" : due.tone}>{due.text}</Pill>}
          {d.assignee && <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">{isAdmin ? <Link href={`/people/${d.assignee.id}`} className="inline-flex items-center gap-1.5 hover:text-ink"><Avatar name={d.assignee.name} size="xs" />{d.assignee.name}</Link> : <><Avatar name={d.assignee.name} size="xs" />{d.assignee.name}</>}</span>}
        </div>
      </PageHeader>

      {/* Lifecycle */}
      <ol className="panel mb-4 grid grid-cols-4 overflow-hidden" aria-label="Task lifecycle">
        {STEPS.map((s, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "next";
          const blockedHere = t.status === "blocked" && i === 1;
          return (
            <li key={s.key} className={cn("relative flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-r border-line last:border-r-0", state === "done" && "text-ok", state === "current" && (blockedHere ? "text-danger bg-danger-soft/40" : "text-accent bg-accent-soft/40"), state === "next" && "text-ink-4")}>
              {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : blockedHere ? <Ban className="h-4 w-4" /> : <s.Icon className="h-4 w-4" />}
              <span className="truncate">{blockedHere ? "Blocked" : s.label}</span>
              {state === "current" && t.status === "in_progress" && t.feedback && <Pill tone="warn" className="ml-auto hidden sm:inline-flex">Changes requested</Pill>}
              {i < STEPS.length - 1 && <ChevronRight className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-line-strong hidden md:block" />}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {/* Blocked / feedback banners */}
          {t.status === "blocked" && t.blockedReason && <div className="rounded-lg border border-danger/25 bg-danger-soft/50 p-4"><div className="t-label text-danger mb-1">Blocked</div><p className="text-[13px] text-ink">{t.blockedReason}</p>{isAdmin && d.assignee && <p className="mt-2 text-xs text-ink-3">Reply in the discussion below, or <Link href={`/messages?userId=${d.assignee.id}`} className="text-accent hover:underline">message {d.assignee.name.split(" ")[0]}</Link>.</p>}</div>}
          {t.status === "in_progress" && t.feedback && <div className="rounded-lg border border-warn/25 bg-warn-soft/50 p-4"><div className="t-label text-warn mb-1">Changes requested</div><p className="text-[13px] text-ink whitespace-pre-wrap">{t.feedback}</p></div>}
          {t.status === "completed" && t.feedback && <div className="rounded-lg border border-ok/25 bg-ok-soft/50 p-4"><div className="t-label text-ok mb-1">Approved with feedback</div><p className="text-[13px] text-ink whitespace-pre-wrap">{t.feedback}</p></div>}

          <Section title="Description">
            {t.description ? <p className="text-[13.5px] leading-relaxed text-ink-2 whitespace-pre-wrap">{t.description}</p> : <p className="text-[13px] text-ink-4">No description.{isAdmin && <> <button onClick={() => setDialog("edit")} className="text-accent hover:underline">Add one</button>.</>}</p>}
            {t.skillTags?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{t.skillTags.map((s) => <Pill key={s} tone="neutral">{s}</Pill>)}</div>}
          </Section>

          {/* Submission */}
          <Section title={t.status === "in_review" ? "Submitted for review" : "Submissions"} description={d.submissions.length > 0 ? `${pluralize(d.submissions.length, "submission")} · latest ${formatDateTime(latestSubmission!.submittedAt)}` : undefined}
            actions={isAdmin && t.status === "in_review" ? <><Button size="sm" onClick={() => setDialog("approve")}><Check className="h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="outline" onClick={() => setDialog("changes")}>Request changes</Button></> : undefined}>
            {d.submissions.length === 0 ? (
              <EmptyState compact icon={<Send />} title={canAct ? "Nothing submitted yet" : "No submission yet"} description={canAct ? (t.status === "todo" ? "Start the task, do the work, then submit what you completed for review." : "When you're done, submit what you completed. Your manager reviews it here.") : "The assignee hasn't submitted anything for this task."} action={canAct && (t.status === "in_progress" || t.status === "blocked") ? <Button size="sm" onClick={() => setDialog("submit")}><Send className="h-3.5 w-3.5" />Submit for review</Button> : undefined} />
            ) : (
              <div className="space-y-3">
                {d.submissions.map((s, i) => (
                  <div key={s.id} className={cn("rounded-md border p-3", i === 0 ? "border-info/25 bg-info-soft/30" : "border-line bg-surface-2/60")}>
                    <div className="flex items-center justify-between gap-2 mb-1.5"><span className="text-xs font-medium text-ink">{i === 0 ? "Latest" : `Revision ${d.submissions.length - i}`}</span><span className="text-xs text-ink-3">{formatDateTime(s.submittedAt)}</span></div>
                    <p className="text-[13px] text-ink-2 whitespace-pre-wrap leading-relaxed">{s.submission}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Discussion */}
          <Section title="Discussion" description={d.comments.length > 0 ? pluralize(d.comments.length, "comment") : undefined}>
            {d.comments.length === 0 ? <p className="text-[13px] text-ink-3 mb-3">No comments yet. Questions, context, and decisions about this task live here.</p> : (
              <ul className="space-y-3 mb-4">
                {d.comments.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <Avatar name={c.authorName ?? "?"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2"><span className="text-[13px] font-medium text-ink">{c.authorName ?? "Removed user"}</span>{c.authorRole === "admin" && <Pill tone="neutral">Manager</Pill>}<RelativeTime value={c.createdAt} className="text-[11px] text-ink-4" /></div>
                      <p className="mt-0.5 text-[13px] text-ink-2 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={(e) => { e.preventDefault(); if (!comment.trim()) return; m.comment.mutate({ content: comment.trim() }, { onSuccess: () => setComment("") }); }} className="flex gap-2.5">
              <Avatar name={user?.name ?? "?"} size="sm" className="mt-1" />
              <div className="flex-1">
                <label htmlFor="comment" className="sr-only">Write a comment</label>
                <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); (e.currentTarget.form as HTMLFormElement)?.requestSubmit(); } }} rows={2} placeholder="Write a comment… (⌘↵ to send)" maxLength={4000} />
                <div className="mt-2 flex justify-end"><Button size="sm" type="submit" disabled={!comment.trim() || m.comment.isPending}><MessageSquare className="h-3.5 w-3.5" />{m.comment.isPending ? "Posting…" : "Comment"}</Button></div>
              </div>
            </form>
          </Section>

          <Section title="Activity">
            <Timeline>
              {d.history.map((h, i) => <TimelineItem key={i} tone={HISTORY_TONE[h.kind] ?? "neutral"} title={h.label} meta={formatDateTime(h.ts)} />)}
            </Timeline>
          </Section>
        </div>

        <aside className="space-y-4 min-w-0">
          <Section title="Details">
            <KeyValue items={[
              { label: "Status", value: <StatusBadge status={t.status} /> },
              { label: "Assignee", value: d.assignee ? (isAdmin ? <Link href={`/people/${d.assignee.id}`} className="inline-flex items-center gap-1.5 hover:text-accent"><Avatar name={d.assignee.name} size="xs" />{d.assignee.name}</Link> : <span className="inline-flex items-center gap-1.5"><Avatar name={d.assignee.name} size="xs" />{d.assignee.name}</span>) : "—" },
              { label: "Project", value: d.project ? <Link href={`/projects/${d.project.id}`} className="inline-flex items-center gap-1 hover:text-accent">{d.project.title}<Pill tone={projectStatusTone(d.project.status).tone}>{projectStatusTone(d.project.status).label}</Pill></Link> : <span className="text-ink-3">None</span> },
              { label: "Priority", value: <PriorityMark priority={t.priority} withLabel /> },
              { label: "Due", value: t.dueDate ? <span className={cn(due?.tone === "danger" && "text-danger")}>{formatDate(t.dueDate, { month: "short", day: "numeric", year: "numeric" })}{due && due.tone !== "muted" ? ` · ${due.text}` : ""}</span> : <span className="text-ink-3">No due date</span> },
              { label: "Created", value: <span>{formatDate(t.createdAt)}{d.creator ? ` by ${d.creator.name}` : ""}</span> },
              ...(t.startedAt ? [{ label: "Started", value: formatDateTime(t.startedAt) }] : []),
              ...(t.completedAt ? [{ label: "Approved", value: formatDateTime(t.completedAt) }] : []),
            ]} />
          </Section>

          {(d.upstream || d.dependents.length > 0) && (
            <Section title="Dependencies">
              {d.upstream && <div className="mb-2"><SectionLabel>Waits on</SectionLabel><Link href={`/tasks/${d.upstream.id}`} className="flex items-center gap-2 text-[13px] hover:text-accent"><StatusBadge status={d.upstream.status} iconOnly /><span className="truncate">{d.upstream.title}</span></Link></div>}
              {d.dependents.length > 0 && <div><SectionLabel>Blocks</SectionLabel><ul className="space-y-1">{d.dependents.map((x) => <li key={x.id}><Link href={`/tasks/${x.id}`} className="flex items-center gap-2 text-[13px] hover:text-accent"><StatusBadge status={x.status} iconOnly /><span className="truncate">{x.title}</span></Link></li>)}</ul></div>}
            </Section>
          )}

          <Section title="Work Mode evidence" description={d.evidence.totalSeconds > 0 ? `${formatDuration(d.evidence.totalSeconds)} observed while this task was in progress` : undefined}>
            {d.evidence.totalSeconds === 0 ? (
              <p className="text-[13px] text-ink-3">No Companion activity has been linked to this task yet. Activity links when this is the only task in progress during a Work Mode session.</p>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-1.5">
                  {d.evidence.sessions.map((s) => (
                    <li key={s.id}><Link href={`/work/replay/${s.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 row-hover text-[13px]"><span className="inline-flex items-center gap-1.5 text-ink"><History className="h-3.5 w-3.5 text-ink-3" />{formatDate(s.startedAt, { month: "short", day: "numeric" })}</span><span className="t-num text-ink-3">{formatDuration(s.seconds)}</span></Link></li>
                  ))}
                </ul>
                <div>
                  <SectionLabel>Observed</SectionLabel>
                  <ul className="space-y-1">
                    {d.evidence.segments.slice(0, 6).map((seg, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs"><Monitor className="h-3.5 w-3.5 text-ink-4 mt-px shrink-0" /><span className="min-w-0 flex-1 truncate text-ink-2" title={seg.label}>{seg.label}</span><span className="t-num text-ink-4 shrink-0">{formatDuration(seg.durationSeconds)}</span></li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-ink-4">Linked by time overlap — not a claim about what was accomplished.</p>
                </div>
              </div>
            )}
          </Section>
        </aside>
      </div>

      {dialog === "submit" && <SubmitDialog open onOpenChange={() => setDialog(null)} pending={m.submit.isPending} previousFeedback={t.feedback} resubmission={!!t.submittedAt} onSubmit={(text) => m.submit.mutate({ submission: text }, { onSuccess: () => setDialog(null) })} />}
      {dialog === "block" && <BlockDialog open onOpenChange={() => setDialog(null)} pending={m.block.isPending} onBlock={(reason) => m.block.mutate({ reason }, { onSuccess: () => setDialog(null) })} />}
      {(dialog === "approve" || dialog === "changes") && <ReviewDialog open onOpenChange={() => setDialog(null)} mode={dialog} pending={m.approve.isPending || m.requestChanges.isPending} submission={latestSubmission?.submission} onApprove={(fb) => m.approve.mutate({ feedback: fb }, { onSuccess: () => setDialog(null) })} onRequestChanges={(fb) => m.requestChanges.mutate({ feedback: fb }, { onSuccess: () => setDialog(null) })} />}
      {dialog === "edit" && <TaskFormDialog open onOpenChange={() => setDialog(null)} initial={{ id: t.id, title: t.title, description: t.description ?? "", assigneeId: t.assigneeId, projectId: t.projectId ?? "", priority: t.priority as "low" | "medium" | "high", dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "", skillTags: t.skillTags ?? [], dependsOnTaskId: t.dependsOnTaskId ?? "" }} />}
      {dialog === "delete" && <ConfirmDialog open onOpenChange={() => setDialog(null)} destructive title="Delete this task?" description="Submissions and comments are deleted with it. Work Mode evidence stays, unlinked. This can't be undone." confirmLabel="Delete" pending={m.remove.isPending} onConfirm={() => m.remove.mutate(undefined, { onSuccess: () => setLocation("/tasks") })} />}
    </Page>
  );
}

