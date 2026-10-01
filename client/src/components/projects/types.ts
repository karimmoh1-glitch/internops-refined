import { useQuery } from "@tanstack/react-query";
import type { Tone } from "@/components/kit";

// Shapes returned by the server. Kept loose on purpose where the backend
// does not guarantee a field (e.g. `versions` only exists on the detail
// endpoint, `latestVersion` only on the intern list).

export type ProjectStatus = "assigned" | "planning" | "submitted" | "active" | "approved" | "pending_approval" | "rejected" | "completed";

export interface WeekPlan {
  weekNumber: number;
  milestone: string;
  deliverables: string[];
  successCriteria: string;
  hours: number;
}

export interface PlanContent {
  hoursPerDay: number;
  daysPerWeek: number;
  numberOfWeeks: number;
  totalPlannedHours: number;
  weeks: WeekPlan[];
}

export interface PlanVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  status: "draft" | "submitted" | "approved" | string;
  contentJson: PlanContent;
  createdAt?: string;
}

export interface PlanComment {
  id: string;
  versionId: string;
  managerId: string | null;
  content: string;
  createdAt: string;
}

export interface WeeklyLog {
  id: string;
  projectId: string;
  weekNumber: number;
  subtaskIndex: number | null;
  dayNumber: number | null;
  logText: string;
  commitRef?: string | null;
  createdAt: string;
}

export interface LogComment {
  id: string;
  logId: string;
  managerId: string | null;
  managerName?: string;
  content: string;
  createdAt: string;
}

export interface Criterion {
  id: string;
  projectId: string;
  text: string;
  optional: boolean;
  completed: boolean;
  completedAt?: string | null;
  taskId?: string | null;
  sortOrder: number;
}

export interface Project {
  id: string;
  internId: string;
  companyId: string;
  title: string;
  idea: string;
  minimumTotalHours: number;
  status: ProjectStatus | string;
  githubRepoUrl?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  // intern list enrichment
  logCount?: number;
  weeklyLogs?: WeeklyLog[];
  latestVersion?: PlanVersion | null;
}

export interface ProjectDetail extends Project {
  versions: PlanVersion[];
  weeklyLogs: WeeklyLog[];
  internName: string;
  completionCriteria: Criterion[];
}

export interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string;
  projectId: string | null;
  dueDate: string | null;
  updatedAt?: string;
  createdAt?: string;
  completedAt?: string | null;
  submittedAt?: string | null;
  startedAt?: string | null;
}

export interface Intern {
  id: string;
  name: string;
  email: string;
  deactivatedAt?: string | null;
}

export type Role = "admin" | "intern";

// ---- helpers --------------------------------------------------------------

export function sortVersions(versions: PlanVersion[] | undefined): PlanVersion[] {
  return [...(versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber);
}

// Mirrors the legacy workspace: the draft wins (it's what the intern is
// editing), then the approved plan (what execution tracks), then whatever
// is in review, then the newest.
export function pickCurrentVersion(versions: PlanVersion[] | undefined): PlanVersion | undefined {
  const sorted = sortVersions(versions);
  return sorted.find((v) => v.status === "draft") ?? sorted.find((v) => v.status === "approved") ?? sorted.find((v) => v.status === "submitted") ?? sorted[0];
}

export function planVersionTone(status: string): { label: string; tone: Tone } {
  switch (status) {
    case "approved": return { label: "Approved", tone: "ok" };
    case "submitted": return { label: "In review", tone: "info" };
    case "draft": return { label: "Draft", tone: "neutral" };
    default: return { label: status.replace(/_/g, " "), tone: "neutral" };
  }
}

export const PLAN_EDITABLE_STATUSES = new Set(["assigned", "planning"]);

export function isOverdue(task: Task, now = new Date()): boolean {
  if (!task.dueDate || task.status === "completed") return false;
  return new Date(task.dueDate).getTime() < now.getTime();
}

export interface TaskStats { total: number; done: number; overdue: number; blocked: number; inReview: number; tasks: Task[] }

export function taskStatsFor(tasks: Task[] | undefined, projectId: string): TaskStats {
  const mine = (tasks ?? []).filter((t) => t.projectId === projectId);
  const now = new Date();
  return {
    total: mine.length,
    done: mine.filter((t) => t.status === "completed").length,
    overdue: mine.filter((t) => isOverdue(t, now)).length,
    blocked: mine.filter((t) => t.status === "blocked").length,
    inReview: mine.filter((t) => t.status === "in_review").length,
    tasks: mine,
  };
}

// One task list per role, shared across the list page and the detail page
// so both read the same cache entry.
export function useTaskList(role: Role) {
  return useQuery<Task[]>({ queryKey: [role === "admin" ? "/api/tasks" : "/api/tasks/mine"], staleTime: 15_000 });
}

export function useInterns(enabled: boolean) {
  return useQuery<Intern[]>({ queryKey: ["/api/interns"], enabled, staleTime: 60_000 });
}

// Deliverable coverage: a deliverable counts as "logged" when at least one
// weekly log references it. This is the legacy getSubtaskCompletion metric.
export function deliverableCoverage(plan: PlanContent | undefined, logs: WeeklyLog[]): { logged: number; total: number } {
  if (!plan) return { logged: 0, total: 0 };
  const seen = new Set<string>();
  for (const l of logs) if (l.subtaskIndex !== null && l.subtaskIndex !== undefined) seen.add(`${l.weekNumber}-${l.subtaskIndex}`);
  let total = 0, logged = 0;
  for (const w of plan.weeks ?? []) {
    const d = w.deliverables ?? [];
    total += d.length;
    d.forEach((_, i) => { if (seen.has(`${w.weekNumber}-${i}`)) logged++; });
  }
  return { logged, total };
}

export const PROJECT_KEYS = {
  list: ["/api/projects"] as const,
  detail: (id: string) => [`/api/projects/${id}`] as const,
  logs: (id: string) => [`/api/weekly-logs/project/${id}`] as const,
  logComments: (id: string) => [`/api/log-comments/project/${id}`] as const,
  planComments: (versionId: string) => [`/api/plan-versions/${versionId}/comments`] as const,
  commits: (id: string) => [`/api/projects/${id}/github/commits`] as const,
  pulls: (id: string) => [`/api/projects/${id}/github/pulls`] as const,
};
