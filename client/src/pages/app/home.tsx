import { useMemo } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Radar, Inbox, Activity, CheckCircle2, Circle, Timer, Users, ListTodo, FolderKanban, X, Monitor, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api, tzOffset } from "@/lib/api";
import { cn } from "@/lib/utils";
import { greeting, formatDuration, pluralize, relativeTime } from "@/lib/format";
import { Page, Section, SectionLabel, Stat, EmptyState, ErrorState, Skeleton, SkeletonRows, Avatar, Pill, LiveClock, RelativeTime, ProgressBar, projectStatusTone, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { WorkModeCard } from "@/components/work/WorkModeCard";
import { TaskRow } from "@/components/home/TaskRow";

export default function Home() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "admin" ? <AdminHome name={user.name} /> : <InternHome name={user.name} />;
}

/* ============================ ADMIN ============================ */

interface Overview {
  now: string;
  company: { id: string; name: string };
  counts: { interns: number; working: number; overdue: number; blocked: number; inReview: number; approvals: number; signals: number; openTasks: number; dueSoon: number; todaySeconds: number; submissionsToday: number };
  working: { sessionId: string; personId: string; name: string; startedAt: string; elapsedSeconds: number; currentTask: { id: string; title: string } | null; companion: "connected" | "stale" | "none"; lastObserved: { application: string; context: string | null; at: string; idleSeconds: number | null } | null }[];
  approvals: { kind: string; id: string; title: string; personId: string | null; personName: string; since: string; link: string }[];
  signals: { key: string; type: string; severity: "high" | "medium"; headline: string; description: string; taskId?: string; projectId?: string; internId?: string }[];
  overdue: any[]; blocked: any[]; dueSoon: any[];
  feed: { ts: string; kind: string; label: string; href: string; personName?: string }[];
  people: { id: string; name: string; working: boolean; openTasks: number; overdue: number; blocked: number; inReview: number; secondsToday: number; hoursWeek: number; signals: number }[];
  onboarding: { dismissed: boolean; steps: { invitedIntern: boolean; createdProject: boolean; createdTask: boolean; firstSession: boolean; companionActivity: boolean } };
  projects: { id: string; title: string; status: string; ownerName: string; ownerId: string; tasks: number; done: number; overdue: number; blocked: number }[];
}

const APPROVAL_LABEL: Record<string, string> = { task_review: "Submission", plan_review: "Plan", proposal: "Proposal", application: "Application", shift_report: "Shift report" };

function AdminHome({ name }: { name: string }) {
  const key = `/api/overview?tzOffsetMinutes=${tzOffset()}`;
  const q = useQuery<Overview>({ queryKey: [key], refetchInterval: 30_000 });
  const qc = useQueryClient();
  const dismiss = useMutation({ mutationFn: () => api("POST", "/api/onboarding/dismiss", { dismissed: true }), onSuccess: () => qc.invalidateQueries({ queryKey: [key] }) });

  const d = q.data;
  const context = useMemo(() => {
    if (!d) return "";
    const parts: string[] = [];
    parts.push(d.counts.working > 0 ? `${pluralize(d.counts.working, "person", "people")} in Work Mode` : "No one in Work Mode");
    if (d.counts.approvals > 0) parts.push(`${pluralize(d.counts.approvals, "item")} waiting on you`);
    if (d.counts.signals > 0) parts.push(`${pluralize(d.counts.signals, "signal")}`);
    if (d.counts.approvals === 0 && d.counts.signals === 0) parts.push("nothing waiting on you");
    return parts.join(" · ");
  }, [d]);

  const onboardingSteps = d ? [
    { done: d.onboarding.steps.invitedIntern, label: "Invite your first intern", href: "/people?invite=1" },
    { done: d.onboarding.steps.createdProject, label: "Assign a project", href: "/projects?new=1" },
    { done: d.onboarding.steps.createdTask, label: "Create a task", href: "/tasks?new=1" },
    { done: d.onboarding.steps.firstSession, label: "An intern runs a Work Mode session", href: "/work" },
    { done: d.onboarding.steps.companionActivity, label: "The Companion reports activity", href: "/download" },
  ] : [];
  const showOnboarding = d && !d.onboarding.dismissed && onboardingSteps.some((s) => !s.done);

  return (
    <Page width="wide">
      <header className="pt-6 md:pt-8 pb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-page">{greeting()}, {name.split(" ")[0]}.</h1>
          {q.isLoading ? <Skeleton className="h-4 w-72 mt-2" /> : <p className="mt-1 text-[13px] text-ink-3">{context}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/pulse?q=What%20needs%20my%20attention%3F"><Sparkles className="h-4 w-4 text-pulse" />Ask Pulse</Link></Button>
          <Button size="sm" asChild><Link href="/tasks?new=1">New task</Link></Button>
        </div>
      </header>

      {q.error ? <ErrorState title="We couldn't load your workspace" message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ---------- Primary column ---------- */}
          <div className="min-w-0 space-y-4">
            {showOnboarding && (
              <section className="panel p-4 anim-fade-up">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="t-section">Set up {d!.company.name}</h2><p className="text-xs text-ink-3 mt-0.5">{onboardingSteps.filter((s) => s.done).length} of {onboardingSteps.length} done — the rest unlocks the whole loop: task → Work Mode → replay → signals.</p></div>
                  <Button variant="ghost" size="icon-xs" aria-label="Dismiss setup checklist" onClick={() => dismiss.mutate()}><X className="h-3.5 w-3.5" /></Button>
                </div>
                <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {onboardingSteps.map((s) => (
                    <li key={s.label}>
                      <Link href={s.href} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] row-hover", s.done ? "text-ink-3" : "text-ink")}>
                        {s.done ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <Circle className="h-4 w-4 text-ink-4" />}<span className={cn(s.done && "line-through")}>{s.label}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Right now */}
            <Section title="Right now" description={d ? `${pluralize(d.counts.working, "person", "people")} in Work Mode · ${formatDuration(d.counts.todaySeconds)} recorded today` : undefined} actions={<Button variant="ghost" size="xs" asChild><Link href="/work">Work<ArrowRight className="h-3.5 w-3.5" /></Link></Button>} flush>
              {q.isLoading ? <div className="p-4"><SkeletonRows rows={3} /></div> : d!.working.length === 0 ? (
                <EmptyState compact icon={<Timer />} title="No one is in Work Mode" description={d!.counts.interns === 0 ? "Invite an intern to get started." : "When an intern starts a session, they'll appear here with a live timer and what the Companion observes."} />
              ) : (
                <ul className="divide-y divide-line">
                  {d!.working.map((w) => (
                    <li key={w.sessionId} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={w.name} working size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link href={`/people/${w.personId}`} className="text-[13px] font-medium text-ink hover:text-accent truncate">{w.name}</Link>
                          <LiveClock since={w.startedAt} className="text-xs text-work" />
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3 min-w-0">
                          {w.currentTask ? <Link href={`/tasks/${w.currentTask.id}`} className="truncate hover:text-ink">{w.currentTask.title}</Link> : <span>No task in progress</span>}
                        </div>
                      </div>
                      <div className="hidden sm:block text-right min-w-0 max-w-[260px]">
                        {w.companion === "connected" && w.lastObserved ? (
                          <><div className="flex items-center justify-end gap-1.5 text-[11px] text-work"><Monitor className="h-3 w-3" />Observed {relativeTime(w.lastObserved.at)}</div><p className="text-xs text-ink-2 truncate">{w.lastObserved.application}{w.lastObserved.context ? ` — ${w.lastObserved.context}` : ""}</p></>
                        ) : w.companion === "stale" ? <Pill tone="warn">Companion not reporting</Pill> : <Pill tone="neutral">Time only</Pill>}
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label={`Open replay for ${w.name}`} asChild><Link href={`/work/replay/${w.sessionId}`}><Activity className="h-4 w-4" /></Link></Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Attention lists */}
            <div className="grid gap-4 xl:grid-cols-2">
              <Section title="Overdue" description={d ? pluralize(d.counts.overdue, "task") : undefined} actions={<Button variant="ghost" size="xs" asChild><Link href="/tasks?view=overdue">All</Link></Button>}>
                {q.isLoading ? <SkeletonRows rows={3} /> : d!.overdue.length === 0 ? <p className="text-[13px] text-ink-3 py-2">Nothing is overdue.</p> : <div className="space-y-0.5">{d!.overdue.map((t) => <TaskRow key={t.id} task={t} showAssignee />)}</div>}
              </Section>
              <Section title="Blocked" description={d ? pluralize(d.counts.blocked, "task") : undefined} actions={<Button variant="ghost" size="xs" asChild><Link href="/tasks?status=blocked">All</Link></Button>}>
                {q.isLoading ? <SkeletonRows rows={3} /> : d!.blocked.length === 0 ? <p className="text-[13px] text-ink-3 py-2">Nothing is blocked.</p> : <div className="space-y-0.5">{d!.blocked.map((t) => <TaskRow key={t.id} task={t} showAssignee />)}</div>}
              </Section>
            </div>

            {/* Projects */}
            <Section title="Projects" actions={<Button variant="ghost" size="xs" asChild><Link href="/projects">All<ArrowRight className="h-3.5 w-3.5" /></Link></Button>} flush>
              {q.isLoading ? <div className="p-4"><SkeletonRows rows={3} /></div> : d!.projects.length === 0 ? (
                <EmptyState compact icon={<FolderKanban />} title="No projects yet" description="Assign a project to give an intern a container for their work." action={<Button size="sm" asChild><Link href="/projects?new=1">Assign a project</Link></Button>} />
              ) : (
                <ul className="divide-y divide-line">
                  {d!.projects.slice(0, 6).map((p) => {
                    const st = projectStatusTone(p.status);
                    return (
                      <li key={p.id}>
                        <Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 row-hover">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0"><span className="truncate text-[13px] font-medium text-ink">{p.title}</span><Pill tone={st.tone}>{st.label}</Pill></div>
                            <div className="mt-1 flex items-center gap-2"><ProgressBar value={p.done} max={Math.max(p.tasks, 1)} tone={p.overdue > 0 || p.blocked > 0 ? "warn" : "ok"} className="max-w-[180px]" size="xs" /><span className="t-num text-[11px] text-ink-3">{p.done}/{p.tasks}</span>{p.overdue > 0 && <Pill tone="danger">{p.overdue} overdue</Pill>}{p.blocked > 0 && <Pill tone="danger">{p.blocked} blocked</Pill>}</div>
                          </div>
                          <span className="hidden sm:flex items-center gap-1.5 text-xs text-ink-3"><Avatar name={p.ownerName} size="xs" />{p.ownerName}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </div>

          {/* ---------- Side rail ---------- */}
          <aside className="space-y-4 min-w-0">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Waiting on you" value={d?.counts.approvals ?? "–"} tone={d && d.counts.approvals > 0 ? "accent" : "neutral"} href="/tasks?status=in_review" icon={<Inbox />} />
              <Stat label="Signals" value={d?.counts.signals ?? "–"} tone={d && d.counts.signals > 0 ? "warn" : "neutral"} href="/signals" icon={<Radar />} />
              <Stat label="Due in 3 days" value={d?.counts.dueSoon ?? "–"} href="/tasks?view=due-soon" icon={<ListTodo />} />
              <Stat label="Interns" value={d?.counts.interns ?? "–"} hint={d ? `${d.counts.working} working` : undefined} href="/people" icon={<Users />} />
            </div>

            <Section title="Waiting on you" description={d && d.counts.approvals > 0 ? `${d.counts.approvals} to review` : undefined} flush>
              {q.isLoading ? <div className="p-4"><SkeletonRows rows={4} /></div> : d!.approvals.length === 0 ? (
                <EmptyState compact icon={<Inbox />} title="Inbox zero" description="Submissions, plans, proposals, and applications that need a decision land here." />
              ) : (
                <ul className="divide-y divide-line">
                  {d!.approvals.map((a) => (
                    <li key={`${a.kind}-${a.id}`}>
                      <Link href={a.link} className="flex items-center gap-3 px-4 py-2.5 row-hover">
                        <Avatar name={a.personName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] text-ink">{a.title}</p>
                          <p className="text-[11px] text-ink-3">{APPROVAL_LABEL[a.kind] ?? a.kind} · {a.personName} · <RelativeTime value={a.since} /></p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-ink-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Signals" actions={<Button variant="ghost" size="xs" asChild><Link href="/signals">All</Link></Button>} flush>
              {q.isLoading ? <div className="p-4"><SkeletonRows rows={3} /></div> : d!.signals.length === 0 ? (
                <EmptyState compact icon={<Radar />} title="All quiet" description="No overdue, blocked, stalled, or waiting work right now." />
              ) : (
                <ul className="divide-y divide-line">
                  {d!.signals.slice(0, 5).map((s) => (
                    <li key={s.key}>
                      <Link href={s.taskId ? `/tasks/${s.taskId}` : s.projectId ? `/projects/${s.projectId}` : s.internId ? `/people/${s.internId}` : "/signals"} className="block px-4 py-2.5 row-hover">
                        <div className="flex items-center gap-2"><span className={cn("h-1.5 w-1.5 rounded-full", s.severity === "high" ? "bg-danger" : "bg-warn")} /><span className="text-xs font-medium text-ink">{s.headline}</span></div>
                        <p className="mt-0.5 text-[12.5px] text-ink-2 leading-snug">{s.description}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Recent activity" flush>
              {q.isLoading ? <div className="p-4"><SkeletonRows rows={5} /></div> : d!.feed.length === 0 ? (
                <EmptyState compact icon={<Activity />} title="Nothing yet" description="Submissions, approvals, started tasks, and ended sessions will stream here." />
              ) : (
                <ul className="divide-y divide-line">
                  {d!.feed.slice(0, 10).map((f, i) => (
                    <li key={i}>
                      <Link href={f.href} className="flex items-start gap-2.5 px-4 py-2 row-hover">
                        <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", f.kind === "approved" ? "bg-ok" : f.kind === "submitted" ? "bg-info" : f.kind === "shift" ? "bg-work" : "bg-accent")} />
                        <span className="min-w-0 flex-1 text-[12.5px] text-ink-2 leading-snug">{f.label}</span>
                        <RelativeTime value={f.ts} className="text-[11px] text-ink-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </aside>
        </div>
      )}
    </Page>
  );
}

/* ============================ INTERN ============================ */

interface MeOverview {
  now: string;
  workMode: { sessionId: string; startedAt: string; companion: string } | null;
  time: { today: { totalSeconds: number; sessionCount: number }; week: { totalSeconds: number; sessionCount: number } };
  priority: { task: any; reason: string } | null;
  alternates: any[]; today: any[]; upcoming: any[]; inReview: any[]; blocked: any[]; feedback: any[]; recentlyCompleted: any[];
  projects: { id: string; title: string; status: string; tasks: number; done: number }[];
  counts: { open: number; overdue: number; inReview: number; blocked: number; completed: number };
  notifications: { id: string; title: string; message: string; link: string | null; createdAt: string; read: boolean }[];
}

function InternHome({ name }: { name: string }) {
  const key = `/api/me/overview?tzOffsetMinutes=${tzOffset()}`;
  const q = useQuery<MeOverview>({ queryKey: [key], refetchInterval: 30_000 });
  const qc = useQueryClient();
  const { toast } = useToast();
  const startTask = useMutation({
    mutationFn: (id: string) => api("POST", `/api/tasks/${id}/start`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [key] }); qc.invalidateQueries({ queryKey: ["/api/tasks/mine"] }); },
    onError: (e: Error) => toast({ title: "Couldn't start the task", description: e.message, variant: "destructive" }),
  });
  const d = q.data;

  const context = useMemo(() => {
    if (!d) return "";
    const parts: string[] = [];
    const dueToday = d.today.filter((t) => t.status !== "in_progress").length;
    if (d.counts.overdue > 0) parts.push(`${pluralize(d.counts.overdue, "task")} overdue`);
    else if (dueToday > 0) parts.push(`${pluralize(dueToday, "task")} due today`);
    if (d.counts.inReview > 0) parts.push(`${d.counts.inReview} in review`);
    if (d.feedback.some((t) => t.status === "in_progress")) parts.push("new feedback");
    if (parts.length === 0) parts.push(d.counts.open === 0 ? "nothing assigned yet" : `${pluralize(d.counts.open, "open task")}`);
    return parts.join(" · ");
  }, [d]);

  return (
    <Page>
      <header className="pt-6 md:pt-8 pb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-page">{greeting()}, {name.split(" ")[0]}.</h1>
          {q.isLoading ? <Skeleton className="h-4 w-64 mt-2" /> : <p className="mt-1 text-[13px] text-ink-3">{context}</p>}
        </div>
        <Button variant="outline" size="sm" asChild><Link href="/pulse"><Sparkles className="h-4 w-4 text-pulse" />Ask Pulse</Link></Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <WorkModeCard />

          {q.error ? <ErrorState title="We couldn't load your work" message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
            <>
              {/* Priority */}
              <section className="panel p-4 anim-fade-up">
                <SectionLabel>Start with</SectionLabel>
                {q.isLoading ? <SkeletonRows rows={2} /> : !d!.priority ? (
                  d!.counts.open === 0
                    ? <EmptyState compact icon={<ListTodo />} title="Nothing assigned yet" description="When your manager assigns a task, it appears here with a reason for why it's first." />
                    : <p className="text-[13px] text-ink-3">Everything open is blocked or waiting on review. {d!.counts.blocked > 0 && <Link href="/tasks?status=blocked" className="text-accent hover:underline">Check your blocked work.</Link>}</p>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/tasks/${d!.priority.task.id}`} className="block text-[15px] font-semibold text-ink hover:text-accent leading-snug">{d!.priority.task.title}</Link>
                      <p className="mt-1 text-[13px] text-ink-3">{d!.priority.reason}</p>
                      <div className="mt-2 flex items-center gap-2"><StatusBadge status={d!.priority.task.status} />{d!.priority.task.dueDate && <Pill tone="neutral">Due {new Date(d!.priority.task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Pill>}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d!.priority.task.status === "todo" ? (
                        <Button size="sm" onClick={() => startTask.mutate(d!.priority!.task.id)} disabled={startTask.isPending}>{startTask.isPending ? "Starting…" : "Start task"}</Button>
                      ) : (
                        <Button size="sm" asChild><Link href={`/tasks/${d!.priority.task.id}`}>Continue<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
                      )}
                    </div>
                  </div>
                )}
                {d && d.alternates.length > 0 && <p className="mt-3 text-xs text-ink-3">Then: {d.alternates.map((t, i) => <span key={t.id}>{i > 0 && ", "}<Link href={`/tasks/${t.id}`} className="text-ink-2 hover:text-accent">{t.title}</Link></span>)}</p>}
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Today" description={d ? pluralize(d.today.length, "task") : undefined}>
                  {q.isLoading ? <SkeletonRows rows={3} /> : d!.today.length === 0 ? <p className="text-[13px] text-ink-3 py-1">Nothing due or in progress today.</p> : <div className="space-y-0.5">{d!.today.map((t) => <TaskRow key={t.id} task={t} />)}</div>}
                </Section>
                <Section title="Coming up">
                  {q.isLoading ? <SkeletonRows rows={3} /> : d!.upcoming.length === 0 ? <p className="text-[13px] text-ink-3 py-1">No upcoming deadlines.</p> : <div className="space-y-0.5">{d!.upcoming.map((t) => <TaskRow key={t.id} task={t} />)}</div>}
                </Section>
              </div>

              {d && d.feedback.filter((t) => t.status === "in_progress").length > 0 && (
                <Section title="Changes requested" description="Your manager asked for revisions">
                  <ul className="space-y-3">
                    {d.feedback.filter((t) => t.status === "in_progress").map((t) => (
                      <li key={t.id} className="rounded-md border border-warn/25 bg-warn-soft/50 p-3">
                        <Link href={`/tasks/${t.id}`} className="text-[13px] font-medium text-ink hover:text-accent">{t.title}</Link>
                        <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">“{t.feedback}”</p>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {d && (d.inReview.length > 0 || d.blocked.length > 0) && (
                <div className="grid gap-4 xl:grid-cols-2">
                  {d.inReview.length > 0 && <Section title="Waiting on review" description={pluralize(d.inReview.length, "submission")}><div className="space-y-0.5">{d.inReview.map((t) => <TaskRow key={t.id} task={t} />)}</div></Section>}
                  {d.blocked.length > 0 && <Section title="Blocked" description="Unblock when you can move again"><div className="space-y-0.5">{d.blocked.map((t) => <TaskRow key={t.id} task={t} />)}</div></Section>}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Today" value={d ? formatDuration(d.time.today.totalSeconds, { compact: true }) : "–"} hint={d ? pluralize(d.time.today.sessionCount, "session") : undefined} tone="work" href="/work" icon={<Timer />} />
            <Stat label="This week" value={d ? formatDuration(d.time.week.totalSeconds, { compact: true }) : "–"} hint={d ? pluralize(d.time.week.sessionCount, "session") : undefined} href="/work" icon={<Timer />} />
          </div>

          <Section title="Projects" actions={<Button variant="ghost" size="xs" asChild><Link href="/projects">All</Link></Button>} flush>
            {q.isLoading ? <div className="p-4"><SkeletonRows rows={2} /></div> : (d?.projects.length ?? 0) === 0 ? (
              <EmptyState compact icon={<FolderKanban />} title="No project yet" description="Your manager can assign one, or you can propose an idea." action={<Button variant="outline" size="sm" asChild><Link href="/projects?propose=1">Propose a project</Link></Button>} />
            ) : (
              <ul className="divide-y divide-line">
                {d!.projects.map((p) => { const st = projectStatusTone(p.status); return (
                  <li key={p.id}><Link href={`/projects/${p.id}`} className="block px-4 py-2.5 row-hover"><div className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-medium text-ink">{p.title}</span><Pill tone={st.tone}>{st.label}</Pill></div>{p.tasks > 0 && <div className="mt-1.5 flex items-center gap-2"><ProgressBar value={p.done} max={p.tasks} tone="ok" size="xs" /><span className="t-num text-[11px] text-ink-3">{p.done}/{p.tasks}</span></div>}</Link></li>
                ); })}
              </ul>
            )}
          </Section>

          <Section title="Recently approved" flush>
            {q.isLoading ? <div className="p-4"><SkeletonRows rows={2} /></div> : (d?.recentlyCompleted.length ?? 0) === 0 ? <p className="px-4 py-3 text-[13px] text-ink-3">Approved work will show up here.</p> : (
              <ul className="divide-y divide-line">{d!.recentlyCompleted.map((t) => <li key={t.id}><Link href={`/tasks/${t.id}`} className="flex items-center gap-2.5 px-4 py-2 row-hover"><CheckCircle2 className="h-4 w-4 text-ok shrink-0" /><span className="truncate text-[13px] text-ink">{t.title}</span></Link></li>)}</ul>
            )}
          </Section>

          <Section title="Notifications" actions={<Button variant="ghost" size="xs" asChild><Link href="/messages"><MessageSquare className="h-3.5 w-3.5" />Messages</Link></Button>} flush>
            {q.isLoading ? <div className="p-4"><SkeletonRows rows={3} /></div> : (d?.notifications.length ?? 0) === 0 ? <p className="px-4 py-3 text-[13px] text-ink-3">You're all caught up.</p> : (
              <ul className="divide-y divide-line">{d!.notifications.slice(0, 5).map((n) => <li key={n.id}><Link href={n.link ?? "/"} className="flex items-start gap-2.5 px-4 py-2 row-hover"><span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-transparent border border-line-strong" : "bg-accent")} /><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] text-ink">{n.title}</span><span className="block truncate text-[11px] text-ink-3">{n.message}</span></span><RelativeTime value={n.createdAt} className="text-[11px] text-ink-4" /></Link></li>)}</ul>
            )}
          </Section>
        </aside>
      </div>
    </Page>
  );
}
