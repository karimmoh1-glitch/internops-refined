import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Check, ExternalLink, Github, Lightbulb, ListTodo, MoreHorizontal, Pencil, Plus, RotateCcw, Send, Sparkles, Trash2, X, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { dueLabel, formatDate, pluralize } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Page, PageHeader, Section, EmptyState, ErrorState, Skeleton, SkeletonRows, Pill, StatusBadge, StatusIcon, PriorityMark, KeyValue, RelativeTime, ConfirmDialog, Stat, projectStatusTone, TASK_STATUS_META, type TaskStatus } from "@/components/kit";
import { EditProjectDialog, ProposeProjectDialog, RejectProposalDialog, invalidateProject, useApproveProposal } from "@/components/projects/dialogs";
import { PlanSummary, PlanDisplay, VersionHistory, PlanCommentList, usePlanComments, GeneratePlanDialog, NoPlanState } from "@/components/projects/plan";
import { PlanReviewCard } from "@/components/projects/plan-review";
import { UnifiedAIChat } from "@/components/projects/ai-chat";
import { ExecutionDisplay } from "@/components/projects/execution";
import { DefinitionOfDone } from "@/components/projects/criteria";
import { ProjectHealth } from "@/components/projects/health";
import { GitHubActivity } from "@/components/projects/github-activity";
import { PROJECT_KEYS, PLAN_EDITABLE_STATUSES, deliverableCoverage, pickCurrentVersion, planVersionTone, sortVersions, taskStatsFor, useTaskList, type LogComment, type PlanVersion, type ProjectDetail, type Role, type Task } from "@/components/projects/types";

type Tab = "overview" | "tasks" | "plan" | "execution" | "activity";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" }, { key: "tasks", label: "Tasks" }, { key: "plan", label: "Plan" }, { key: "execution", label: "Execution" }, { key: "activity", label: "Activity" },
];

function DetailSkeleton() {
  return (
    <Page>
      <div className="pt-6 md:pt-8 pb-5 space-y-3" aria-busy aria-label="Loading project">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-3.5 w-56" />
      </div>
      <div className="flex gap-4 border-b border-line pb-3 mb-6">{TABS.map((t) => <Skeleton key={t.key} className="h-4 w-16" />)}</div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div>
        <div className="space-y-4"><Skeleton className="h-56" /><Skeleton className="h-40" /></div>
      </div>
    </Page>
  );
}

// ---- Intern: manager feedback on the current version (and the one it was
// revised from, since a revision request opens a brand-new draft and the
// note lives on the previous version). -----------------------------------------

function ManagerFeedback({ current, previous }: { current: PlanVersion; previous?: PlanVersion }) {
  const cur = usePlanComments(current.id);
  const prev = usePlanComments(previous?.id);
  const loading = cur.isLoading || prev.isLoading;
  const prevComments = prev.data ?? [];
  const curComments = cur.data ?? [];
  return (
    <Section title="Manager feedback" description={current.status === "draft" && previous ? `v${current.versionNumber} was opened after a revision request on v${previous.versionNumber}.` : "Notes your manager left on this plan."}>
      {loading ? <SkeletonRows rows={2} /> : (cur.error || prev.error) ? <ErrorState compact message={((cur.error ?? prev.error) as Error).message} onRetry={() => { void cur.refetch(); void prev.refetch(); }} /> : (
        <div className="space-y-4">
          {previous && prevComments.length > 0 && (
            <div>
              <p className="t-label mb-1.5">What to change from v{previous.versionNumber}</p>
              <PlanCommentList comments={prevComments} />
            </div>
          )}
          <div>
            {previous && prevComments.length > 0 && <p className="t-label mb-1.5">On v{current.versionNumber}</p>}
            <PlanCommentList comments={curComments} emptyText={previous && prevComments.length > 0 ? "No notes on this version yet." : "No manager feedback yet. You'll see revision requests and comments here as soon as they're left."} />
          </div>
        </div>
      )}
    </Section>
  );
}

// ---- Tasks tab ----------------------------------------------------------------

function TaskList({ tasks, isAdmin, projectId }: { tasks: Task[]; isAdmin: boolean; projectId: string }) {
  if (tasks.length === 0) {
    return (
      <Section title="Tasks" flush>
        <EmptyState icon={<ListTodo />} title="No tasks linked to this project" description={isAdmin ? "Tasks are the unit of work managers assign and review. Create one and pick this project so progress rolls up here." : "Your manager hasn't linked any tasks to this project yet. Work you log in Execution still counts."}
          action={isAdmin ? <Button asChild size="sm"><Link href={`/tasks?new=1&projectId=${projectId}`}><Plus className="h-4 w-4" />Create a task</Link></Button> : undefined} />
      </Section>
    );
  }
  const sorted = [...tasks].sort((a, b) => (TASK_STATUS_META[a.status as TaskStatus]?.order ?? 9) - (TASK_STATUS_META[b.status as TaskStatus]?.order ?? 9) || new Date(a.dueDate ?? 8.64e15).getTime() - new Date(b.dueDate ?? 8.64e15).getTime());
  return (
    <Section title="Tasks" description={`${tasks.filter((t) => t.status === "completed").length} of ${pluralize(tasks.length, "task")} approved`} actions={isAdmin ? <Button asChild variant="outline" size="xs"><Link href={`/tasks?new=1&projectId=${projectId}`}><Plus className="h-3.5 w-3.5" />New task</Link></Button> : undefined} flush>
      <ul className="divide-y divide-line">
        {sorted.map((t) => {
          const due = dueLabel(t.dueDate, t.status);
          return (
            <li key={t.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 row-hover">
              <StatusIcon status={t.status} />
              <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 basis-[200px] truncate text-[13px] font-medium text-ink after:absolute after:inset-0 after:content-['']">{t.title}</Link>
              <PriorityMark priority={t.priority} />
              {due && <span className={cn("t-num text-xs", due.tone === "danger" ? "text-danger" : due.tone === "warn" ? "text-warn" : due.tone === "ok" ? "text-ok" : "text-ink-3")}>{due.text}</span>}
              <StatusBadge status={t.status} />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ---- Page ---------------------------------------------------------------------

export default function ProjectDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const role: Role = user?.role ?? "intern";
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const tabParam = new URLSearchParams(search).get("tab") as Tab | null;
  const tab: Tab = tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : "overview";

  const detail = useQuery<ProjectDetail>({ queryKey: PROJECT_KEYS.detail(id), staleTime: 10_000 });
  const tasks = useTaskList(role);
  const project = detail.data;
  const logComments = useQuery<LogComment[]>({ queryKey: PROJECT_KEYS.logComments(id), enabled: !!project && (project.status === "active" || project.status === "approved"), staleTime: 10_000 });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const approve = useApproveProposal();

  const versions = useMemo(() => sortVersions(project?.versions), [project?.versions]);
  const current = pickCurrentVersion(versions);
  const approved = versions.find((v) => v.status === "approved");
  const submitted = versions.find((v) => v.status === "submitted");
  const previous = current ? versions.find((v) => v.versionNumber === current.versionNumber - 1) : undefined;
  const stats = tasks.data && project ? taskStatsFor(tasks.data, project.id) : undefined;
  const logs = project?.weeklyLogs ?? [];
  const criteria = project?.completionCriteria ?? [];
  const isExecution = !!project && (project.status === "active" || project.status === "approved") && !!approved;

  const submitPlan = useMutation({
    mutationFn: () => api("POST", `/api/plan-versions/${current!.id}/submit`),
    onSuccess: () => { invalidateProject(qc, id); toast({ title: "Plan submitted", description: "Your manager has been notified. You'll hear back here." }); },
    onError: (e: Error) => toast({ title: "Couldn't submit plan", description: e.message, variant: "destructive" }),
  });
  const resetPlan = useMutation({
    mutationFn: () => api("DELETE", `/api/plan-versions/project/${id}`),
    onSuccess: () => { invalidateProject(qc, id); setResetOpen(false); toast({ title: "Plan reset", description: "Every draft was removed. Generate a new one when you're ready." }); },
    onError: (e: Error) => toast({ title: "Couldn't reset plan", description: e.message, variant: "destructive" }),
  });
  const deleteProject = useMutation({
    mutationFn: () => api("DELETE", `/api/projects/${id}`),
    onSuccess: () => { invalidateProject(qc, id); qc.removeQueries({ queryKey: PROJECT_KEYS.detail(id) }); toast({ title: "Project deleted" }); setLocation("/projects"); },
    onError: (e: Error) => toast({ title: "Couldn't delete project", description: e.message, variant: "destructive" }),
  });

  if (detail.isLoading) return <DetailSkeleton />;
  if (detail.error || !project) {
    return (
      <Page>
        <PageHeader crumbs={[{ label: "Projects", href: "/projects" }, { label: "Project" }]} title="Project" />
        <div className="panel"><ErrorState title="We couldn't open this project" message={(detail.error as Error | undefined)?.message ?? "It may have been deleted or you may not have access."} onRetry={() => detail.refetch()} /></div>
      </Page>
    );
  }

  const st = projectStatusTone(project.status);
  const isProposal = project.status === "pending_approval";
  const tabHref = (t: Tab) => (t === "overview" ? `/projects/${id}` : `/projects/${id}?tab=${t}`);
  const coverage = deliverableCoverage(approved?.contentJson, logs);
  const required = criteria.filter((c) => !c.optional);
  const requiredMet = required.filter((c) => c.completed).length;
  const canGenerate = !isAdmin && PLAN_EDITABLE_STATUSES.has(project.status);
  const canReset = !isAdmin && versions.length > 0 && PLAN_EDITABLE_STATUSES.has(project.status);

  const metadata = (
    <Section title="Details">
      <KeyValue items={[
        { label: "Owner", value: isAdmin ? <Link href={`/people/${project.internId}`} className="text-ink hover:underline underline-offset-2">{project.internName}</Link> : project.internName },
        { label: "Status", value: <Pill tone={st.tone}>{st.label}</Pill> },
        { label: "Minimum", value: <span className="t-num">{project.minimumTotalHours}h</span> },
        ...(current?.contentJson ? [{ label: "Planned", value: <span className="t-num">{current.contentJson.totalPlannedHours}h · {current.contentJson.numberOfWeeks}w</span> }] : []),
        { label: "Plan", value: current ? <Link href={tabHref("plan")} className="hover:underline underline-offset-2">v{current.versionNumber} · {planVersionTone(current.status).label}</Link> : <span className="text-ink-3">None yet</span> },
        { label: "Tasks", value: stats ? <Link href={tabHref("tasks")} className="t-num hover:underline underline-offset-2">{stats.done}/{stats.total} approved</Link> : <span className="text-ink-3">Unavailable</span> },
        { label: "Repository", value: project.githubRepoUrl ? <a href={project.githubRepoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate hover:underline underline-offset-2"><Github className="h-3.5 w-3.5 shrink-0 text-ink-3" /><span className="truncate">{project.githubRepoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")}</span><ExternalLink className="h-3 w-3 shrink-0 text-ink-4" /></a> : <Link href={tabHref("activity")} className="text-ink-3 hover:text-ink">Not linked</Link> },
        ...(project.createdAt ? [{ label: "Created", value: <span title={formatDate(project.createdAt, { dateStyle: "medium" })}><RelativeTime value={project.createdAt} live={false} /></span> }] : []),
      ]} />
    </Section>
  );
  const rail = <>{metadata}<ProjectHealth project={project} stats={stats} versions={versions} criteria={criteria} logs={logs} /></>;

  const headerActions = isAdmin ? (
    isProposal ? (
      <>
        <Button variant="outline" onClick={() => setRejectOpen(true)}><X className="h-4 w-4" />Decline</Button>
        <Button onClick={() => approve.mutate(project)} disabled={approve.isPending}><Check className="h-4 w-4" />{approve.isPending ? "Approving…" : "Approve proposal"}</Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" />Edit</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-danger focus:text-danger"><Trash2 className="h-4 w-4" />Delete project</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )
  ) : project.status === "rejected" ? (
    <Button onClick={() => setProposeOpen(true)}><Lightbulb className="h-4 w-4" />Propose another</Button>
  ) : undefined;

  return (
    <Page>
      <PageHeader
        crumbs={[{ label: "Projects", href: "/projects" }, { label: project.title }]}
        title={project.title}
        actions={headerActions}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Pill tone={st.tone}>{st.label}</Pill>
            {isAdmin ? <Link href={`/people/${project.internId}`} className="hover:text-ink hover:underline underline-offset-2">{project.internName}</Link> : <span>{project.internName}</span>}
            <span aria-hidden>·</span><span className="t-num">{project.minimumTotalHours}h minimum</span>
            {current?.contentJson && <><span aria-hidden>·</span><span className="t-num">{current.contentJson.totalPlannedHours}h planned</span></>}
          </span>
        }
      >
        <nav className="mt-5 -mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Project sections">
          {TABS.map((t) => {
            const active = t.key === tab;
            const count = t.key === "tasks" ? stats?.total : t.key === "plan" ? (versions.length || undefined) : undefined;
            return (
              <Link key={t.key} href={tabHref(t.key)} aria-current={active ? "page" : undefined} replace
                className={cn("-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors", active ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
                {t.label}{count !== undefined && <span className={cn("t-num text-[10.5px]", active ? "text-ink-3" : "text-ink-4")}>{count}</span>}
              </Link>
            );
          })}
        </nav>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start pt-1">
        {/* ---- Main column ---- */}
        <div className="min-w-0 space-y-4 anim-fade" key={tab}>
          {tab === "overview" && (
            <>
              {project.status === "rejected" && (
                <div className="rounded-lg border border-danger/20 bg-danger-soft/60 p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">This proposal wasn't approved</p>
                      <p className="mt-0.5 text-[13px] text-ink-2">{project.rejectionReason || "No reason was given."}</p>
                      {!isAdmin && <p className="mt-1 text-xs text-ink-3">This idea won't move forward, but you can propose something else.</p>}
                    </div>
                  </div>
                </div>
              )}
              {isProposal && (
                <div className="rounded-lg border border-warn/25 bg-warn-soft/60 p-4 text-[13px] text-ink-2">
                  {isAdmin ? <><span className="font-medium text-ink">{project.internName} proposed this project.</span> Approve it to assign it and open planning, or decline with a reason.</> : <><span className="font-medium text-ink">Waiting for a manager's decision.</span> You'll be notified as soon as it's approved or declined.</>}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Tasks" value={stats ? `${stats.done}/${stats.total}` : "–"} hint={stats ? (stats.overdue > 0 ? `${stats.overdue} past due` : stats.total > 0 ? "approved" : "none linked") : "unavailable"} tone={stats?.overdue ? "danger" : "neutral"} href={tabHref("tasks")} />
                <Stat label="Plan" value={current ? `v${current.versionNumber}` : "–"} hint={current ? planVersionTone(current.status).label : "not drafted"} tone={current?.status === "approved" ? "ok" : current?.status === "submitted" ? "info" : "neutral"} href={tabHref("plan")} />
                {isExecution
                  ? <Stat label="Deliverables" value={`${coverage.logged}/${coverage.total}`} hint="with work logged" tone={coverage.total > 0 && coverage.logged === coverage.total ? "ok" : "neutral"} href={tabHref("execution")} />
                  : <Stat label="Done criteria" value={`${requiredMet}/${required.length}`} hint={criteria.length ? "required met" : "none defined"} tone={required.length > 0 && requiredMet === required.length ? "ok" : "neutral"} />}
              </div>
              <Section title="Idea"><p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">{project.idea}</p></Section>
              <DefinitionOfDone projectId={project.id} criteria={criteria} canEdit={isAdmin} />
              <Section title="Recent task activity" description="Ordered by the last change to each task." actions={stats && stats.total > 0 ? <Button asChild variant="ghost" size="xs"><Link href={tabHref("tasks")}>All tasks</Link></Button> : undefined} flush>
                {tasks.isLoading ? <div className="p-4"><SkeletonRows rows={3} /></div>
                  : tasks.error ? <ErrorState compact message={(tasks.error as Error).message} onRetry={() => tasks.refetch()} />
                  : !stats || stats.total === 0 ? <EmptyState compact icon={<ListTodo />} title="No task activity" description="Tasks linked to this project show their latest changes here." />
                  : (
                    <ul className="divide-y divide-line">
                      {[...stats.tasks].sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()).slice(0, 6).map((t) => (
                        <li key={t.id} className="relative flex items-center gap-3 px-4 py-2.5 row-hover">
                          <StatusIcon status={t.status} />
                          <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-[13px] text-ink after:absolute after:inset-0 after:content-['']">{t.title}</Link>
                          <span className="text-xs text-ink-3">{TASK_STATUS_META[t.status as TaskStatus]?.label ?? t.status}</span>
                          <RelativeTime value={t.updatedAt ?? t.createdAt} className="t-num text-xs text-ink-3" live={false} />
                        </li>
                      ))}
                    </ul>
                  )}
              </Section>
            </>
          )}

          {tab === "tasks" && (
            tasks.isLoading ? <Section title="Tasks"><SkeletonRows rows={5} /></Section>
              : tasks.error ? <Section title="Tasks"><ErrorState compact message={(tasks.error as Error).message} onRetry={() => tasks.refetch()} /></Section>
              : <TaskList tasks={stats?.tasks ?? []} isAdmin={isAdmin} projectId={project.id} />
          )}

          {tab === "plan" && (
            isAdmin ? (
              versions.length === 0 || !current ? <div className="panel"><NoPlanState canGenerate={false} minimumHours={project.minimumTotalHours} /></div> : (
                <>
                  <PlanReviewCard project={project} version={submitted ?? current} />
                  <VersionHistory versions={versions} currentId={(submitted ?? current).id} projectId={project.id} canComment />
                </>
              )
            ) : (
              isProposal || project.status === "rejected" ? (
                <div className="panel"><EmptyState icon={<Sparkles />} title={isProposal ? "Planning opens after approval" : "This proposal was declined"} description={isProposal ? "Once a manager approves the proposal you can draft a plan here with the mentor." : "Declined proposals can't be planned. Propose another idea from the project header."} /></div>
              ) : versions.length === 0 || !current ? (
                <div className="panel"><NoPlanState canGenerate={canGenerate} minimumHours={project.minimumTotalHours} onGenerate={() => setGenerateOpen(true)} /></div>
              ) : (
                <>
                  <PlanSummary plan={current.contentJson} minimumHours={project.minimumTotalHours} version={current} />
                  {current.status === "submitted" && <div className="rounded-lg border border-info/20 bg-info-soft/60 px-4 py-3 text-[13px] text-ink-2"><span className="font-medium text-ink">Under review.</span> Your manager will approve it or ask for changes. You can keep talking to the mentor meanwhile.</div>}
                  {current.status === "draft" && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3">
                      <p className="min-w-0 flex-1 text-[13px] text-ink-2">Happy with v{current.versionNumber}? Submit it so your manager can review it.</p>
                      {canReset && <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}><RotateCcw className="h-3.5 w-3.5" />Reset plan</Button>}
                      <Button size="sm" onClick={() => submitPlan.mutate()} disabled={submitPlan.isPending || current.contentJson.totalPlannedHours < project.minimumTotalHours}><Send className="h-3.5 w-3.5" />{submitPlan.isPending ? "Submitting…" : "Submit for review"}</Button>
                    </div>
                  )}
                  <ManagerFeedback current={current} previous={previous} />
                  <Section title="Weekly plan"><PlanDisplay plan={current.contentJson} /></Section>
                  <VersionHistory versions={versions} currentId={current.id} projectId={project.id} canComment={false} />
                </>
              )
            )
          )}

          {tab === "execution" && (
            isExecution && approved ? (
              logComments.isLoading ? <Section title="Execution"><SkeletonRows rows={4} /></Section>
                : <ExecutionDisplay projectId={project.id} plan={approved.contentJson} logs={logs} logComments={logComments.data ?? []} role={role} canLog={!isAdmin && project.status === "active"} />
            ) : (
              <div className="panel">
                <EmptyState icon={<ListTodo />} title="Execution starts once a plan is approved"
                  description={isAdmin ? "After you approve a submitted plan, weekly logs against each deliverable appear here and you can leave feedback on them." : "Once your manager approves your plan, you'll log what you did against each week's deliverables here, and see their feedback."}
                  action={<Button asChild variant="outline" size="sm"><Link href={tabHref("plan")}>Go to plan</Link></Button>} />
              </div>
            )
          )}

          {tab === "activity" && <GitHubActivity projectId={project.id} repoUrl={project.githubRepoUrl} isAdmin={isAdmin} />}
        </div>

        {/* ---- Side rail ---- */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-[72px]">
          {tab === "plan" && !isAdmin && !isProposal && project.status !== "rejected"
            ? <UnifiedAIChat projectId={project.id} projectStatus={project.status} hasPlan={!!current} minimumHours={project.minimumTotalHours} className="h-[560px] lg:h-[calc(100dvh-104px)] lg:max-h-[820px]" />
            : rail}
        </aside>
      </div>

      {isAdmin && <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />}
      {isAdmin && <RejectProposalDialog project={rejectOpen ? project : null} open={rejectOpen} onOpenChange={setRejectOpen} />}
      {!isAdmin && <ProposeProjectDialog open={proposeOpen} onOpenChange={setProposeOpen} />}
      {!isAdmin && <GeneratePlanDialog projectId={project.id} minimumHours={project.minimumTotalHours} open={generateOpen} onOpenChange={setGenerateOpen} />}
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Delete "${project.title}"?`} description="Every plan version, weekly log, comment and criterion on this project is permanently removed. The intern is notified." confirmLabel="Delete project" destructive pending={deleteProject.isPending} onConfirm={() => deleteProject.mutate()} />
      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title="Reset your plan?" description="Every draft version is deleted and the project goes back to Assigned. This only works before a plan has been submitted." confirmLabel="Reset plan" destructive pending={resetPlan.isPending} onConfirm={() => resetPlan.mutate()} />
    </Page>
  );
}
