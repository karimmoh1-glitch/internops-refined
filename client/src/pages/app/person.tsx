import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarClock, FileBadge, FolderKanban, FolderPlus, GraduationCap, ListPlus, ListTodo, MessageSquare, MoreHorizontal, Power, RotateCcw, ShieldPlus, Square, Trash2 } from "lucide-react";
import { aggregateSkillTags } from "@shared/skills";
import { cn } from "@/lib/utils";
import { formatDate, formatDuration, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, Dot, EmptyState, ErrorState, KeyValue, LiveClock, Page, PageHeader, Pill, Section, Skeleton, SkeletonRows, Stat, TASK_STATUS_META, type TaskStatus, projectStatusTone } from "@/components/kit";
import { ActionConfirm, type PendingAction, TypedDeleteDialog } from "@/components/people/confirm";
import { useInternActions } from "@/components/people/use-intern-actions";
import { ExpectedEndDateDialog, NarrativePanel, SessionsPanel, SignalsPanel, SkillsPanel, TaskRows } from "@/components/people/person-panels";
import { type Alumnus, type Dashboard, type InternRow, type Overview, type PersonSignal, type Project, type Task, type WorkSession, type WorkSummary, type WorktimeSummary, invalidatePeople, overviewKey, signalsKey } from "@/components/people/types";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function PersonPage({ id }: { id: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const actions = useInternActions();
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const interns = useQuery<InternRow[]>({ queryKey: ["/api/interns"] });
  const dashboard = useQuery<Dashboard>({ queryKey: ["/api/dashboard"] });
  const alumni = useQuery<Alumnus[]>({ queryKey: ["/api/alumni"] });
  const overview = useQuery<Overview>({ queryKey: [overviewKey()], refetchInterval: 30_000, staleTime: 20_000 });
  const tasks = useQuery<Task[]>({ queryKey: ["/api/tasks"], refetchInterval: 30_000 });
  const projects = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const sessions = useQuery<WorkSession[]>({ queryKey: [`/api/interns/${id}/work-sessions`], refetchInterval: 20_000 });
  const summaries = useQuery<WorkSummary[]>({ queryKey: [`/api/interns/${id}/work-summaries`] });
  const worktime = useQuery<WorktimeSummary>({ queryKey: [`/api/interns/${id}/worktime-summary`] });
  const signals = useQuery<PersonSignal[]>({ queryKey: [signalsKey()], refetchInterval: 60_000 });

  const base = interns.data?.find((i) => i.id === id);
  const meta = dashboard.data?.interns.find((i) => i.id === id);
  const alumnus = alumni.data?.find((a) => a.id === id);
  const person = overview.data?.people.find((p) => p.id === id);
  const live = overview.data?.working.find((w) => w.personId === id);
  const activeSession = sessions.data?.find((s) => s.status === "active");
  const working = !!activeSession || !!live;
  const workingSince = activeSession?.startedAt ?? live?.startedAt ?? null;
  const isAlumni = !!(alumnus || meta?.alumniAt);
  const deactivated = !!(base?.deactivatedAt ?? meta?.deactivatedAt);

  const myTasks = useMemo(() => (tasks.data ?? []).filter((t) => t.assigneeId === id), [tasks.data, id]);
  const myProjects = useMemo(() => (projects.data ?? []).filter((p) => p.internId === id), [projects.data, id]);
  const mySignals = useMemo(() => (signals.data ?? []).filter((s) => s.internId === id), [signals.data, id]);
  const summaryBySession = useMemo(() => new Map((summaries.data ?? []).map((s) => [s.sessionId, s])), [summaries.data]);

  const now = Date.now();
  const open = myTasks.filter((t) => t.status !== "completed");
  const inProgress = open.filter((t) => t.status === "in_progress").sort((a, b) => new Date(b.startedAt ?? b.updatedAt ?? 0).getTime() - new Date(a.startedAt ?? a.updatedAt ?? 0).getTime());
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now).length;
  const inReview = open.filter((t) => t.status === "in_review").length;
  const completed = myTasks.filter((t) => t.status === "completed");
  const recentlyApproved = [...completed].sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()).slice(0, 5);
  const skills = useMemo(() => alumnus ? alumnus.alumniRecord.skillTagCounts : aggregateSkillTags(completed), [alumnus, completed]);
  const byStatus = (s: TaskStatus) => open.filter((t) => t.status === s).sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity));

  const name = base?.name ?? meta?.name ?? alumnus?.name ?? "";
  const email = base?.email ?? meta?.email ?? alumnus?.email ?? "";
  const ref = { id, name };

  const badge = useMutation({
    mutationFn: (awarded: boolean) => api("POST", `/api/interns/${id}/completion-badge`, { awarded }),
    onSuccess: (_d, awarded) => { invalidatePeople(qc); toast({ title: awarded ? "Completion badge awarded" : "Completion badge revoked", description: awarded ? "Shown on their public profile if they've enabled it." : undefined }); },
    onError: (err: Error) => toast({ title: "Couldn't update badge", description: err.message, variant: "destructive" }),
  });
  const transition = useMutation({
    mutationFn: () => api("POST", `/api/interns/${id}/transition-alumni`, {}),
    onSuccess: () => { invalidatePeople(qc, ["/api/tasks", "/api/signals"]); toast({ title: "Moved to alumni", description: `${name}'s stats, skills, and narrative are frozen into their record.` }); },
    onError: (err: Error) => toast({ title: "Couldn't transition", description: err.message, variant: "destructive" }),
  });

  // ----- Loading / not found -----
  const identityLoading = interns.isLoading || (dashboard.isLoading && !base) || (alumni.isLoading && !base);
  if (identityLoading) {
    return (
      <Page width="wide">
        <PageHeader crumbs={[{ label: "People", href: "/people" }, { label: "…" }]} title={<Skeleton className="h-7 w-48" />} />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3"><div className="lg:col-span-2 space-y-4"><Skeleton className="h-48" /><Skeleton className="h-40" /></div><div className="space-y-4"><Skeleton className="h-56" /><Skeleton className="h-40" /></div></div>
      </Page>
    );
  }
  if (interns.error && !base && !alumnus) {
    return <Page width="wide"><PageHeader crumbs={[{ label: "People", href: "/people" }]} title="Person" /><ErrorState message={(interns.error as Error).message} onRetry={() => { void interns.refetch(); void alumni.refetch(); }} /></Page>;
  }
  if (!base && !alumnus && !meta) {
    return (
      <Page width="wide">
        <PageHeader crumbs={[{ label: "People", href: "/people" }]} title="Person not found" />
        <EmptyState title="No one with this ID in your workspace" description="They may have been deleted, or the link is from another workspace." action={<Button asChild variant="outline" size="sm"><Link href="/people">Back to People</Link></Button>} />
      </Page>
    );
  }

  // ----- Header pieces -----
  const statusLine = isAlumni
    ? <span className="inline-flex items-center gap-1.5 text-xs text-ink-3"><GraduationCap className="h-3.5 w-3.5" />Internship ended {formatDate(alumnus?.alumniRecord.internshipEndedAt ?? meta?.alumniAt, { month: "short", day: "numeric", year: "numeric" })}</span>
    : deactivated
      ? <span className="inline-flex items-center gap-1.5 text-xs text-ink-3"><Dot tone="neutral" />Deactivated {formatDate(base?.deactivatedAt ?? meta?.deactivatedAt)}</span>
      : working
        ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-work"><Dot tone="work" pulse />Working now{workingSince && <> · <LiveClock since={workingSince} /></>}{live?.currentTask && <span className="font-normal text-ink-3"> · on <Link href={`/tasks/${live.currentTask.id}`} className="text-ink-2 hover:underline">{live.currentTask.title}</Link></span>}</span>
        : <span className="inline-flex items-center gap-1.5 text-xs text-ink-3"><Dot tone="neutral" className="opacity-50" />Not working</span>;

  const badgeAwarded = alumnus ? alumnus.alumniRecord.completionBadgeAwarded : !!meta?.completionBadgeAwardedAt;

  const headerActions = isAlumni ? (
    <>
      <Button asChild variant="outline" size="sm"><Link href={`/alumni/${id}/certificate`}><FileBadge className="h-4 w-4" />Certificate</Link></Button>
      <Button size="sm" variant="outline" onClick={() => setConfirm({ title: `Reopen ${name}'s internship?`, description: "They can sign in again as an active intern. The alumni record stays on file.", confirmLabel: "Reactivate", run: () => actions.reactivateAlumnus.mutateAsync(ref) })}><RotateCcw className="h-4 w-4" />Reactivate</Button>
    </>
  ) : (
    <>
      <Button asChild variant="outline" size="sm"><Link href={`/messages?userId=${id}`}><MessageSquare className="h-4 w-4" />Message</Link></Button>
      {working && <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setConfirm({ title: `End ${name}'s shift?`, description: "Their Work Mode session closes now and a shift report is generated. They'll be notified that a manager ended it.", confirmLabel: "End shift", destructive: true, run: () => actions.endShift.mutateAsync(ref) })}><Square className="h-4 w-4" />End shift</Button>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon-sm" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem asChild><Link href={`/tasks?new=1&assigneeId=${id}`}><ListPlus className="h-4 w-4" />Assign task</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href={`/projects?new=1&internId=${id}`}><FolderPlus className="h-4 w-4" />Assign project</Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEndDateOpen(true)}><CalendarClock className="h-4 w-4" />{meta?.expectedEndDate ? `Expected end: ${formatDate(meta.expectedEndDate, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : "Set expected end date"}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm(badgeAwarded
            ? { title: `Revoke ${name}'s completion badge?`, description: "It disappears from their public profile.", confirmLabel: "Revoke badge", destructive: true, run: () => badge.mutateAsync(false) }
            : { title: `Award ${name} the completion badge?`, description: "A manager-granted credential. It shows on their public profile if they've enabled it, and on their certificate.", confirmLabel: "Award badge", run: () => badge.mutateAsync(true) })}>
            <Award className="h-4 w-4" />{badgeAwarded ? "Revoke completion badge" : "Award completion badge"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm({ title: `End ${name}'s internship?`, description: "Freezes their tasks, skills, and narrative into an alumni record, ends any active shift, and closes sign-in. You can reopen it from the Alumni tab.", confirmLabel: "Transition to alumni", destructive: true, run: () => transition.mutateAsync() })}><GraduationCap className="h-4 w-4" />Transition to alumni</DropdownMenuItem>
          <DropdownMenuSeparator />
          {deactivated
            ? <DropdownMenuItem onSelect={() => setConfirm({ title: `Reactivate ${name}?`, description: "They can sign in again with everything intact.", confirmLabel: "Reactivate", run: () => actions.reactivate.mutateAsync(ref) })}><Power className="h-4 w-4" />Reactivate</DropdownMenuItem>
            : <>
              <DropdownMenuItem onSelect={() => setConfirm({ title: `Deactivate ${name}?`, description: "They won't be able to sign in and any active shift ends. Tasks, sessions, and messages stay.", confirmLabel: "Deactivate", destructive: true, run: () => actions.deactivate.mutateAsync(ref) })}><Power className="h-4 w-4" />Deactivate</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirm({ title: `Promote ${name} to manager?`, description: "Full manager access to every intern, task, project, and setting. Any active shift ends.", confirmLabel: "Promote", run: () => actions.promote.mutateAsync(ref) })}><ShieldPlus className="h-4 w-4" />Promote to manager</DropdownMenuItem>
            </>}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(true)}><Trash2 className="h-4 w-4" />Delete permanently</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  const metricsReady = !!overview.data;
  const facts = isAlumni && alumnus ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Tasks completed" value={<>{alumnus.alumniRecord.totalTasksCompleted}<span className="text-base text-ink-3">/{alumnus.alumniRecord.totalTasksAssigned}</span></>} hint="At the time the internship ended" />
      <Stat label="Internship" value={<span className="text-base">{alumnus.alumniRecord.internshipStartedAt ? formatDate(alumnus.alumniRecord.internshipStartedAt, { month: "short", year: "numeric" }) : "Unknown"} – {formatDate(alumnus.alumniRecord.internshipEndedAt, { month: "short", year: "numeric" })}</span>} />
      <Stat label="Skills recorded" value={alumnus.alumniRecord.skillTagCounts.length} />
      <Stat label="Completion badge" value={<span className="text-base">{alumnus.alumniRecord.completionBadgeAwarded ? "Awarded" : "Not awarded"}</span>} tone={alumnus.alumniRecord.completionBadgeAwarded ? "ok" : "neutral"} icon={<Award />} />
    </div>
  ) : (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Today" value={metricsReady ? (person && person.secondsToday > 0 ? formatDuration(person.secondsToday, { compact: true }) : "—") : <Skeleton className="h-6 w-14" />} hint={working ? "Includes the live shift" : undefined} tone={working ? "work" : "neutral"} />
      <Stat label="This week" value={metricsReady ? (person && person.hoursWeek > 0 ? `${Math.round(person.hoursWeek * 10) / 10}h` : "—") : <Skeleton className="h-6 w-14" />} hint={worktime.data ? `${formatDuration(worktime.data.overall.totalSeconds, { compact: true })} all time` : undefined} />
      <Stat label="Open tasks" value={tasks.data ? open.length : <Skeleton className="h-6 w-8" />} href="/tasks" />
      <Stat label="Overdue" value={tasks.data ? overdue : <Skeleton className="h-6 w-8" />} tone={overdue > 0 ? "danger" : "neutral"} />
      <Stat label="In review" value={tasks.data ? inReview : <Skeleton className="h-6 w-8" />} tone={inReview > 0 ? "info" : "neutral"} hint={inReview > 0 ? "Waiting on you" : undefined} />
    </div>
  );

  return (
    <Page width="wide">
      <PageHeader crumbs={[{ label: "People", href: isAlumni ? "/people?tab=alumni" : "/people" }, { label: name }]}
        eyebrow={isAlumni ? "Alumni" : deactivated ? "Deactivated intern" : "Intern"}
        title={<span className="flex min-w-0 flex-wrap items-center gap-3"><Avatar name={name} size="lg" working={working} /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{name}</span>{badgeAwarded && <Pill tone="ok" icon={<Award className="h-3 w-3" />}>Completion badge</Pill>}</span>}
        description={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{email}</span>{statusLine}{meta?.expectedEndDate && !isAlumni && <span className="text-xs text-ink-3">Expected end {formatDate(meta.expectedEndDate, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>}</span>}
        actions={headerActions} />

      {facts}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {tasks.isLoading ? <Section title="Current work"><SkeletonRows rows={4} /></Section> :
            tasks.error ? <Section title="Current work"><ErrorState compact message={(tasks.error as Error).message} onRetry={() => void tasks.refetch()} /></Section> :
            open.length === 0 ? (
              <Section title="Current work" flush>
                <EmptyState compact icon={<ListTodo />} title={isAlumni ? "No open tasks" : "Nothing assigned"} description={isAlumni ? "Their open tasks were left as they were when the internship ended." : `${name} has no open tasks. Assign one so their next step is clear.`}
                  action={!isAlumni && <Button asChild size="sm"><Link href={`/tasks?new=1&assigneeId=${id}`}>Assign task</Link></Button>} />
              </Section>
            ) : (
              <Section title="Current work" description={`${pluralize(open.length, "open task")} · ${pluralize(completed.length, "approved")}`} flush
                actions={!isAlumni && <Button asChild variant="ghost" size="xs"><Link href={`/tasks?new=1&assigneeId=${id}`}><ListPlus className="h-3.5 w-3.5" />Assign</Link></Button>}>
                {inProgress.length > 0 && <div><div className="flex items-center gap-2 px-4 pt-3 pb-1.5"><span className="t-label">In progress</span><span className="t-num text-xs text-ink-4">{inProgress.length}</span></div><TaskRows tasks={inProgress} /></div>}
                {(["in_review", "blocked", "todo"] as TaskStatus[]).map((s) => {
                  const list = byStatus(s);
                  if (list.length === 0) return null;
                  const m = TASK_STATUS_META[s];
                  return <div key={s} className="border-t border-line"><div className="flex items-center gap-2 px-4 pt-3 pb-1.5"><m.Icon className={cn("h-3.5 w-3.5", s === "blocked" ? "text-danger" : s === "in_review" ? "text-info" : "text-ink-4")} /><span className="t-label">{m.label}</span><span className="t-num text-xs text-ink-4">{list.length}</span></div><TaskRows tasks={list} /></div>;
                })}
              </Section>
            )}

          <Section title="Projects" flush actions={!isAlumni && <Button asChild variant="ghost" size="xs"><Link href={`/projects?new=1&internId=${id}`}><FolderPlus className="h-3.5 w-3.5" />Assign</Link></Button>}>
            {projects.isLoading ? <div className="p-4"><SkeletonRows rows={2} /></div> :
              projects.error ? <ErrorState compact message={(projects.error as Error).message} onRetry={() => void projects.refetch()} /> :
              myProjects.length === 0 ? <EmptyState compact icon={<FolderKanban />} title="No projects" description={isAlumni ? "No project was assigned during the internship." : "Projects give a multi-week arc to the task list."} action={!isAlumni && <Button asChild size="sm" variant="outline"><Link href={`/projects?new=1&internId=${id}`}>Assign project</Link></Button>} /> : (
                <ul className="divide-y divide-line">
                  {myProjects.map((p) => {
                    const st = projectStatusTone(p.status);
                    const pt = myTasks.filter((t) => t.projectId === p.id);
                    const done = pt.filter((t) => t.status === "completed").length;
                    return (
                      <li key={p.id} className="relative row-hover">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                          <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink before:absolute before:inset-0 hover:underline underline-offset-2">{p.title}</Link>
                          <Pill tone={st.tone}>{st.label}</Pill>
                          <span className="t-num text-xs text-ink-3">{pt.length > 0 ? `${done}/${pt.length} tasks` : "no tasks"} · {p.minimumTotalHours}h min</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
          </Section>

          {recentlyApproved.length > 0 && (
            <Section title="Recently approved" flush>
              <ul className="divide-y divide-line">
                {recentlyApproved.map((t) => (
                  <li key={t.id} className="relative row-hover"><div className="flex items-center gap-3 px-4 py-2"><TASK_STATUS_META.completed.Icon className="h-3.5 w-3.5 shrink-0 text-ok" /><Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-[13px] text-ink before:absolute before:inset-0 hover:underline underline-offset-2">{t.title}</Link><span className="shrink-0 text-xs text-ink-3">{t.completedAt ? formatDate(t.completedAt) : ""}</span></div></li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <SessionsPanel sessions={sessions.data ?? []} summaries={summaryBySession} isLoading={sessions.isLoading} error={sessions.error} onRetry={() => void sessions.refetch()} />
          {worktime.data && worktime.data.overall.sessionCount > 0 && (
            <Section title="All time">
              <KeyValue items={[
                { label: "Total", value: <span className="t-num">{formatDuration(worktime.data.overall.totalSeconds)}</span> },
                { label: "Sessions", value: <span className="t-num">{worktime.data.overall.sessionCount}</span> },
                { label: "Average", value: <span className="t-num">{formatDuration(worktime.data.overall.avgSessionSeconds)}</span> },
              ]} />
            </Section>
          )}
          {!isAlumni && <SignalsPanel signals={mySignals} isLoading={signals.isLoading} error={signals.error} onRetry={() => void signals.refetch()} />}
          <SkillsPanel skills={skills} note={isAlumni ? "Frozen when the internship ended." : undefined} />
          <NarrativePanel internId={id} frozen={alumnus ? { content: alumnus.alumniRecord.finalNarrative } : undefined} />
        </div>
      </div>

      <ActionConfirm action={confirm} onClose={() => setConfirm(null)} />
      <TypedDeleteDialog open={deleting} onOpenChange={setDeleting} name={name} title={`Delete ${name} permanently?`}
        description="This erases their account and every task, work session, report, message, and device tied to it. There is no undo. If you only want to stop them signing in, deactivate instead."
        onConfirm={async () => { await actions.remove.mutateAsync(ref); navigate("/people"); }} />
      <ExpectedEndDateDialog open={endDateOpen} onOpenChange={setEndDateOpen} internId={id} value={meta?.expectedEndDate ?? null} />
    </Page>
  );
}
