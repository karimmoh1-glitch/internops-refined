import { storage } from "../storage";
import type { Task, Project, User, WorkSession, WorkActivity, Application, TaskSubmission } from "@shared/schema";
import { computeSignals, computeWorktimeSignals, type Signal } from "./signals";
import { summarizeSessions, startOfToday, startOfWeek } from "./worktime";

// One snapshot of everything Pulse Chat, the dashboard overview, and the
// signals page reason about — assembled with a fixed, small number of bulk
// queries (never one per intern / per session) so it stays cheap at any
// cohort size. Every object keeps its id so answers can link back to it.

export interface LiveActivity {
  application: string;
  context: string | null;
  observedAt: string;
  idleSeconds: number | null;
}

export interface OrgContext {
  now: Date;
  tzOffsetMinutes: number;
  todayStart: Date;
  weekStart: Date;
  company: { id: string; name: string };
  interns: User[]; // active (not deactivated, not alumni)
  admins: User[];
  tasks: Task[];
  projects: Project[];
  applications: Application[];
  activeSessions: WorkSession[];
  recentSessions: WorkSession[]; // last 14 days
  todaySessions: WorkSession[];
  weekSessions: WorkSession[];
  liveActivityByInternId: Map<string, LiveActivity>;
  todayActivityByInternId: Map<string, WorkActivity[]>;
  recentSubmissions: TaskSubmission[];
  signals: Signal[];
  internById: Map<string, User>;
  taskById: Map<string, Task>;
  projectById: Map<string, Project>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildOrgContext(companyId: string, opts: { tzOffsetMinutes?: number; now?: Date } = {}): Promise<OrgContext> {
  const now = opts.now ?? new Date();
  const tz = opts.tzOffsetMinutes ?? 0;
  const todayStart = startOfToday(now, tz);
  const weekStart = startOfWeek(now, tz);

  const [company, allUsers, tasks, projects, applications, activeSessions, recentSessions, recentSubmissions, dismissals] = await Promise.all([
    storage.getCompanyById(companyId),
    storage.getUsersByCompany(companyId),
    storage.getTasksByCompany(companyId),
    storage.getProjectsByCompany(companyId),
    storage.getApplicationsByCompany(companyId),
    storage.getActiveWorkSessionsByCompany(companyId),
    storage.getWorkSessionsByCompanySince(companyId, new Date(now.getTime() - 14 * DAY_MS)),
    storage.getRecentTaskSubmissionsByCompany(companyId, 30),
    storage.getSignalDismissalsByCompany(companyId),
  ]);

  const interns = allUsers.filter((u) => u.role === "intern" && !u.deactivatedAt && !u.alumniAt);
  const admins = allUsers.filter((u) => u.role === "admin" && !u.deactivatedAt);
  const internIds = new Set(interns.map((i) => i.id));
  const activeTasks = tasks.filter((t) => internIds.has(t.assigneeId) || allUsers.some((u) => u.id === t.assigneeId && u.role === "admin"));

  const todaySessions = recentSessions.filter((s) => new Date(s.startedAt) >= todayStart || s.status === "active");
  const weekSessions = recentSessions.filter((s) => new Date(s.startedAt) >= weekStart || s.status === "active");

  // Live + today activity in two bulk queries.
  const liveMap = await storage.getLatestWorkActivitiesForSessions(activeSessions.map((s) => s.id));
  const liveActivityByInternId = new Map<string, LiveActivity>();
  for (const s of activeSessions) {
    const latest = liveMap.get(s.id);
    if (!latest) continue;
    liveActivityByInternId.set(s.internId, {
      application: latest.application,
      context: latest.documentName || latest.browserDomain || null,
      observedAt: new Date(latest.endedAt).toISOString(),
      idleSeconds: latest.idleSeconds ?? null,
    });
  }
  const todayActivityByInternId = new Map<string, WorkActivity[]>();
  const todaySessionIds = todaySessions.map((s) => s.id);
  if (todaySessionIds.length > 0) {
    const rows = await storage.getWorkActivitiesBySessions(todaySessionIds);
    const internBySession = new Map(todaySessions.map((s) => [s.id, s.internId]));
    for (const r of rows) {
      const internId = internBySession.get(r.sessionId);
      if (!internId) continue;
      if (!todayActivityByInternId.has(internId)) todayActivityByInternId.set(internId, []);
      todayActivityByInternId.get(internId)!.push(r);
    }
  }

  // Signals, with the manager's dismiss/snooze choices applied.
  const hidden = new Set(dismissals.filter((d) => !d.snoozedUntil || new Date(d.snoozedUntil) > now).map((d) => d.signalKey));
  const internsForSignals = interns.map((i) => ({ id: i.id, name: i.name, deactivatedAt: i.deactivatedAt }));
  const signals = [
    ...computeSignals(internsForSignals, activeTasks.filter((t) => internIds.has(t.assigneeId)), projects),
    ...computeWorktimeSignals(internsForSignals, activeTasks, projects, recentSessions, now.getTime()),
  ].filter((s) => !hidden.has(s.key));

  return {
    now, tzOffsetMinutes: tz, todayStart, weekStart,
    company: { id: companyId, name: company?.name ?? "Workspace" },
    interns, admins, tasks: activeTasks, projects, applications,
    activeSessions, recentSessions, todaySessions, weekSessions,
    liveActivityByInternId, todayActivityByInternId,
    recentSubmissions, signals,
    internById: new Map(allUsers.map((u) => [u.id, u])),
    taskById: new Map(tasks.map((t) => [t.id, t])),
    projectById: new Map(projects.map((p) => [p.id, p])),
  };
}

// ---- Derived views shared by Pulse and the dashboard ----

export function isOverdue(t: Task, now: Date): boolean {
  return !!t.dueDate && t.status !== "completed" && new Date(t.dueDate).getTime() < now.getTime();
}

export function dueWithin(t: Task, now: Date, days: number): boolean {
  if (!t.dueDate || t.status === "completed") return false;
  const due = new Date(t.dueDate).getTime();
  return due >= now.getTime() && due <= now.getTime() + days * DAY_MS;
}

export function hoursThisWeek(ctx: OrgContext, internId: string): number {
  const mine = ctx.weekSessions.filter((s) => s.internId === internId);
  return Math.round((summarizeSessions(mine, ctx.now).totalSeconds / 3600) * 10) / 10;
}

export function secondsToday(ctx: OrgContext, internId: string): number {
  const mine = ctx.todaySessions.filter((s) => s.internId === internId);
  return summarizeSessions(mine, ctx.now).totalSeconds;
}

export interface ApprovalItem {
  kind: "task_review" | "plan_review" | "proposal" | "application" | "shift_report";
  id: string;
  title: string;
  personId: string | null;
  personName: string;
  since: string;
  link: string;
}

// Everything waiting on a manager's decision, in one list.
export async function collectApprovals(ctx: OrgContext): Promise<ApprovalItem[]> {
  const items: ApprovalItem[] = [];
  for (const t of ctx.tasks) {
    if (t.status !== "in_review") continue;
    const who = ctx.internById.get(t.assigneeId);
    items.push({ kind: "task_review", id: t.id, title: t.title, personId: t.assigneeId, personName: who?.name ?? "Unknown", since: (t.submittedAt ?? t.updatedAt ?? t.createdAt) as unknown as string, link: `/tasks/${t.id}` });
  }
  for (const p of ctx.projects) {
    const who = ctx.internById.get(p.internId);
    if (p.status === "submitted") {
      items.push({ kind: "plan_review", id: p.id, title: p.title, personId: p.internId, personName: who?.name ?? "Unknown", since: p.createdAt as unknown as string, link: `/projects/${p.id}?tab=plan` });
    } else if (p.status === "pending_approval") {
      items.push({ kind: "proposal", id: p.id, title: p.title, personId: p.internId, personName: who?.name ?? "Unknown", since: p.createdAt as unknown as string, link: `/projects/${p.id}` });
    }
  }
  for (const a of ctx.applications) {
    if (a.status !== "pending" && a.status !== "under_review") continue;
    if (a.dismissedAt) continue;
    items.push({ kind: "application", id: a.id, title: `${a.name} applied`, personId: null, personName: a.name, since: a.createdAt as unknown as string, link: `/people?tab=applications` });
  }
  items.sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime());
  return items;
}

export function activityRollup(rows: WorkActivity[], limit = 5): { application: string; context: string | null; seconds: number }[] {
  const byApp = new Map<string, { seconds: number; contexts: Set<string> }>();
  for (const a of rows) {
    const entry = byApp.get(a.application) ?? { seconds: 0, contexts: new Set() };
    entry.seconds += a.durationSeconds;
    const ctx = a.documentName || a.browserDomain;
    if (ctx) entry.contexts.add(ctx);
    byApp.set(a.application, entry);
  }
  return Array.from(byApp.entries())
    .map(([application, v]) => ({ application, context: v.contexts.size > 0 ? Array.from(v.contexts).slice(0, 4).join(", ") : null, seconds: v.seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit);
}
