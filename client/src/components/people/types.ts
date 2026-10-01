import type { QueryClient } from "@tanstack/react-query";
import { tzOffset } from "@/lib/api";

// Shapes returned by the people-related endpoints. Kept narrow on purpose:
// only the fields these screens read, so a backend change that matters is
// a type error here rather than an `undefined` in the UI.

export interface InternRow {
  id: string;
  name: string;
  email: string;
  role: "intern";
  createdAt: string | null;
  deactivatedAt: string | null;
}

export interface Manager {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  expiresAt: string;
  used: boolean;
  createdAt: string | null;
}

export type ApplicationStatus = "pending" | "under_review" | "approved" | "rejected" | "needs_information";

export interface Application {
  id: string;
  name: string;
  email: string;
  skills: string | null;
  motivation: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  status: ApplicationStatus | string;
  reviewerNotes: string | null;
  reviewedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export interface AlumniRecord {
  internshipStartedAt: string | null;
  internshipEndedAt: string;
  totalTasksCompleted: number;
  totalTasksAssigned: number;
  skillTagCounts: { tag: string; count: number }[];
  completionBadgeAwarded: boolean;
  finalNarrative: string | null;
}

export interface Alumnus {
  id: string;
  name: string;
  email: string;
  alumniAt: string;
  alumniRecord: AlumniRecord;
}

export interface OverviewPerson {
  id: string;
  name: string;
  working: boolean;
  openTasks: number;
  overdue: number;
  blocked: number;
  inReview: number;
  secondsToday: number;
  hoursWeek: number;
  signals: number;
}

export interface OverviewWorking {
  sessionId: string;
  personId: string;
  name: string;
  startedAt: string;
  elapsedSeconds: number;
  currentTask: { id: string; title: string } | null;
  companion: "connected" | "stale" | "none";
}

export interface OverviewFeedItem {
  ts: string;
  kind: string;
  label: string;
  href: string;
  personId?: string;
  personName?: string;
}

export interface Overview {
  now: string;
  company: { id: string; name: string; acceptingApplications: boolean; slug: string | null };
  counts: Record<string, number>;
  working: OverviewWorking[];
  feed: OverviewFeedItem[];
  people: OverviewPerson[];
}

export interface DashboardIntern {
  id: string;
  name: string;
  email: string;
  deactivatedAt: string | null;
  completionBadgeAwardedAt: string | null;
  alumniAt: string | null;
  expectedEndDate: string | null;
}

export interface Dashboard {
  company: { id: string; name: string; slug: string | null; acceptingApplications: boolean } | null;
  interns: DashboardIntern[];
}

export interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string;
  projectId: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  blockedReason: string | null;
  skillTags: string[] | null;
}

export interface Project {
  id: string;
  title: string;
  status: string;
  internId: string;
  minimumTotalHours: number;
}

export interface WorkSession {
  id: string;
  internId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  status: "active" | "completed";
  endReason: string | null;
  endedByUserId: string | null;
}

export interface WorkSummary {
  id: string;
  sessionId: string;
  durationSeconds: number;
  activityBreakdown: { category: string; label: string; seconds: number }[];
  tasksCompleted: number;
  tasksSubmitted: number;
  nextStep: string | null;
  internNote: string | null;
  generatedAt: string | null;
  submittedAt: string | null;
}

export interface WorktimeSummary {
  today: { totalSeconds: number; sessionCount: number };
  week: { totalSeconds: number; sessionCount: number };
  overall: { totalSeconds: number; sessionCount: number; avgSessionSeconds: number };
}

export interface PersonSignal {
  key: string;
  type: string;
  severity: "high" | "medium";
  headline: string;
  description: string;
  internId?: string;
  taskId?: string;
  projectId?: string;
  evidence: { label: string; value: string }[];
  source: string;
  taskTitle: string | null;
  projectTitle: string | null;
  href: string;
}

export interface Narrative {
  id: string;
  content: string;
  aiGenerated: boolean;
  taskSnapshotCount: number;
  createdAt: string;
}

// Query keys. The app's default queryFn joins string parts with "/", so a
// key with the query string baked in is the whole URL. AppShell polls the
// overview under exactly this key, so pages share its cache.
export const overviewKey = () => `/api/overview?tzOffsetMinutes=${tzOffset()}`;
export const signalsKey = () => `/api/signals?tzOffsetMinutes=${tzOffset()}`;

const PEOPLE_PREFIXES = ["/api/overview", "/api/interns", "/api/managers", "/api/applications", "/api/alumni", "/api/dashboard", "/api/invitations"];

// Invalidate every query whose first key part starts with one of the
// prefixes. Prefix matching (not equality) is what makes
// "/api/overview?tzOffsetMinutes=…" and "/api/interns/<id>/work-sessions"
// refresh together with their list queries.
export function invalidatePeople(qc: QueryClient, extra: string[] = []): void {
  const prefixes = [...PEOPLE_PREFIXES, ...extra];
  void qc.invalidateQueries({
    predicate: (q) => {
      const first = q.queryKey[0];
      return typeof first === "string" && prefixes.some((p) => first.startsWith(p));
    },
  });
}

export const APPLICATION_OPEN_STATUSES = new Set(["pending", "under_review", "needs_information"]);

export function isOpenApplication(a: Application): boolean {
  return APPLICATION_OPEN_STATUSES.has(a.status) && !a.dismissedAt;
}

export function endReasonLabel(reason: string | null | undefined): string | null {
  switch (reason) {
    case "auto_timeout": return "Closed automatically";
    case "admin": return "Ended by manager";
    case "account": return "Ended by account change";
    default: return null;
  }
}
