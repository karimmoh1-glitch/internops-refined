import type { Task, Project, WorkSession } from "@shared/schema";

// Manager Signals: "what actually needs my attention right now?"
//
// Purely rule-based over real task/project data — no AI judgment, no
// productivity scoring. Every signal maps to a concrete, explainable
// workflow condition (overdue, blocked, stalled, pending review, or a
// downstream dependency stuck behind unfinished work). Language is
// deliberately neutral ("possible blocker", "workflow stalled") — this
// flags process problems, never a person's effort or activity level.
//
// Each signal has a stable `key` derived from the entity it's about (e.g.
// "overdue:<taskId>"), so the same live condition always recomputes to the
// same key across requests — that's what lets dismiss/snooze persist
// without a stored, driftable "signal" row (see signalDismissals).

export type SignalType =
  | "deadline_risk"
  | "possible_blocker"
  | "pending_review"
  | "workflow_stalled"
  | "project_at_risk"
  | "no_work_assigned"
  | "overloaded"
  | "inactive"
  | "unusual_hours"
  | "pending_proposal";

export interface SignalAction {
  label: string;
  kind: "view_task" | "view_project" | "view_intern" | "message" | "review";
  taskId?: string;
  projectId?: string;
  userId?: string;
}

export interface Signal {
  key: string;
  type: SignalType;
  severity: "high" | "medium";
  headline: string;
  description: string;
  internId?: string;
  internName?: string;
  taskId?: string;
  projectId?: string;
  actions: SignalAction[];
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function calendarDaysOverdue(dueDate: Date, now: Date): number {
  const dueDay = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - dueDay) / DAY_MS);
}

function businessDaysSince(date: Date, now: number): number {
  let count = 0;
  const cursor = new Date(date);
  const end = new Date(now);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export function computeSignals(
  interns: { id: string; name: string }[],
  tasks: Task[],
  projects: Project[],
): Signal[] {
  const now = Date.now();
  const nowDate = new Date(now);
  const signals: Signal[] = [];
  const internById = new Map(interns.map((i) => [i.id, i]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  for (const task of tasks) {
    const intern = internById.get(task.assigneeId);
    const internName = intern?.name ?? "Unknown";
    const viewAction: SignalAction = { label: "View Task", kind: "view_task", taskId: task.id };
    const messageAction: SignalAction = { label: `Message ${internName}`, kind: "message", userId: task.assigneeId };

    // Blocked, untouched for >48h.
    if (task.status === "blocked") {
      const since = task.updatedAt ? new Date(task.updatedAt) : null;
      if (since && now - since.getTime() > 48 * HOUR_MS) {
        const days = Math.floor((now - since.getTime()) / DAY_MS);
        signals.push({
          key: `blocker:${task.id}`,
          type: "possible_blocker",
          severity: "high",
          headline: "Possible blocker",
          description: `"${task.title}" (${internName}) has been blocked for ${days} day${days === 1 ? "" : "s"}.`,
          internId: task.assigneeId,
          internName,
          taskId: task.id,
          actions: [viewAction, messageAction],
        });
      }
    }

    // Overdue, not completed.
    if (task.dueDate && task.status !== "completed") {
      const days = calendarDaysOverdue(new Date(task.dueDate), nowDate);
      if (days > 0) {
        signals.push({
          key: `overdue:${task.id}`,
          type: "deadline_risk",
          severity: days > 3 ? "high" : "medium",
          headline: "Deadline risk",
          description: `"${task.title}" (${internName}) is overdue by ${days} day${days === 1 ? "" : "s"}.`,
          internId: task.assigneeId,
          internName,
          taskId: task.id,
          actions: [viewAction, messageAction],
        });
      }
    }

    // Awaiting manager review for too long.
    if (task.status === "in_review") {
      const since = task.submittedAt ? new Date(task.submittedAt) : task.updatedAt ? new Date(task.updatedAt) : null;
      if (since && now - since.getTime() > 2 * DAY_MS) {
        const days = Math.floor((now - since.getTime()) / DAY_MS);
        signals.push({
          key: `review:${task.id}`,
          type: "pending_review",
          severity: days > 4 ? "high" : "medium",
          headline: "Pending manager action",
          description: `"${task.title}" (${internName}) has been waiting for review for ${days} day${days === 1 ? "" : "s"}.`,
          internId: task.assigneeId,
          internName,
          taskId: task.id,
          actions: [{ label: "Review", kind: "review", taskId: task.id }],
        });
      }
    }

    // Downstream work stuck behind an unfinished dependency.
    if (task.dependsOnTaskId) {
      const upstream = taskById.get(task.dependsOnTaskId);
      if (upstream && upstream.status !== "completed") {
        const dueSoon = task.dueDate ? calendarDaysOverdue(new Date(task.dueDate), nowDate) >= -2 : false;
        if (dueSoon || task.status === "blocked") {
          signals.push({
            key: `dependency:${task.id}`,
            type: "possible_blocker",
            severity: dueSoon && calendarDaysOverdue(new Date(task.dueDate!), nowDate) > 0 ? "high" : "medium",
            headline: "Possible blocker",
            description: `"${task.title}" (${internName}) can't move forward because "${upstream.title}" isn't finished yet.`,
            internId: task.assigneeId,
            internName,
            taskId: task.id,
            actions: [viewAction, { label: "View Dependency", kind: "view_task", taskId: upstream.id }],
          });
        }
      }
    }
  }

  // Workflow stalled: intern has open work but nothing has moved in 5+
  // business days. One signal per intern, anchored to their oldest
  // untouched open task so it dedupes/resolves the same way task signals do.
  for (const intern of interns) {
    const internTasks = tasks.filter((t) => t.assigneeId === intern.id && t.status !== "completed");
    if (internTasks.length === 0) continue;
    const stalest = internTasks.reduce<Task | null>((oldest, t) => {
      const ts = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
      const oldestTs = oldest?.updatedAt ? new Date(oldest.updatedAt).getTime() : Infinity;
      return ts < oldestTs ? t : oldest;
    }, null);
    if (!stalest?.updatedAt) continue;
    const days = businessDaysSince(new Date(stalest.updatedAt), now);
    if (days >= 5) {
      signals.push({
        key: `stalled:${intern.id}`,
        type: "workflow_stalled",
        severity: "medium",
        headline: "Workflow stalled",
        description: `"${stalest.title}" (${intern.name}) has had no recorded progress for ${days} business days.`,
        internId: intern.id,
        internName: intern.name,
        taskId: stalest.id,
        actions: [
          { label: "View Task", kind: "view_task", taskId: stalest.id },
          { label: `Message ${intern.name}`, kind: "message", userId: intern.id },
        ],
      });
    }
  }

  // Project at risk: 2+ overdue/blocked tasks in the same project, with at
  // least one other task depending on one of them.
  const tasksByProject = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.projectId) continue;
    if (!tasksByProject.has(task.projectId)) tasksByProject.set(task.projectId, []);
    tasksByProject.get(task.projectId)!.push(task);
  }
  for (const [projectId, projectTasks] of Array.from(tasksByProject.entries())) {
    const project = projects.find((p) => p.id === projectId);
    if (!project) continue;
    const troubled = projectTasks.filter((t) => {
      if (t.status === "completed") return false;
      if (t.status === "blocked") return true;
      if (t.dueDate && calendarDaysOverdue(new Date(t.dueDate), nowDate) > 0) return true;
      return false;
    });
    if (troubled.length < 2) continue;
    const troubledIds = new Set(troubled.map((t) => t.id));
    const downstreamCount = projectTasks.filter((t) => t.dependsOnTaskId && troubledIds.has(t.dependsOnTaskId)).length;
    const parts = [`${troubled.length} overdue or blocked task${troubled.length === 1 ? "" : "s"}`];
    if (downstreamCount > 0) parts.push(`${downstreamCount} downstream task${downstreamCount === 1 ? "" : "s"} depend${downstreamCount === 1 ? "s" : ""} on them`);
    signals.push({
      key: `project-risk:${projectId}`,
      type: "project_at_risk",
      severity: "high",
      headline: "Project at risk",
      description: `"${project.title}" has ${parts.join(" and ")}.`,
      projectId,
      actions: [{ label: "View Project", kind: "view_project", projectId }],
    });
  }

  const severityRank = { high: 0, medium: 1 } as const;
  return signals.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

// Worktime-aware signals: same rule-based, explainable approach as
// computeSignals, but over work-session (shift) data instead of task
// timestamps. Kept as a separate function (rather than folded into
// computeSignals) because it needs a different input shape — a window of
// recent sessions per intern — that the task/project-only call sites don't
// have to fetch.
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function computeWorktimeSignals(
  interns: { id: string; name: string; deactivatedAt?: Date | string | null }[],
  tasks: Task[],
  projects: Project[],
  recentSessions: WorkSession[], // last 14 days, all interns in the company
  now: number = Date.now(),
): Signal[] {
  const signals: Signal[] = [];
  const activeInterns = interns.filter((i) => !i.deactivatedAt);
  const todayKey = localDayKey(new Date(now));

  const sessionsByIntern = new Map<string, WorkSession[]>();
  for (const s of recentSessions) {
    if (!sessionsByIntern.has(s.internId)) sessionsByIntern.set(s.internId, []);
    sessionsByIntern.get(s.internId)!.push(s);
  }

  for (const intern of activeInterns) {
    const internTasks = tasks.filter((t) => t.assigneeId === intern.id);
    const openTasks = internTasks.filter((t) => t.status !== "completed");
    const mySessions = sessionsByIntern.get(intern.id) ?? [];

    // No open work at all — nothing to be inactive on, so this is the only
    // worktime signal that applies; skip the rest for this intern.
    if (openTasks.length === 0) {
      signals.push({
        key: `no-work:${intern.id}`,
        type: "no_work_assigned",
        severity: "medium",
        headline: "No work assigned",
        description: `${intern.name} has no open tasks assigned.`,
        internId: intern.id,
        internName: intern.name,
        actions: [{ label: `Message ${intern.name}`, kind: "message", userId: intern.id }],
      });
      continue;
    }

    // Overloaded: 5+ open tasks due within the next 7 days is the line
    // between "busy" and "needs the admin to redistribute work" — a fixed,
    // documented threshold rather than a fuzzy judgment call. 8+ escalates
    // to high severity.
    const dueSoonCount = openTasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() <= now + 7 * DAY_MS).length;
    if (dueSoonCount >= 5) {
      signals.push({
        key: `overloaded:${intern.id}`,
        type: "overloaded",
        severity: dueSoonCount >= 8 ? "high" : "medium",
        headline: "Heavy workload",
        description: `${intern.name} has ${dueSoonCount} tasks due within the next 7 days.`,
        internId: intern.id,
        internName: intern.name,
        actions: [{ label: "Review Workload", kind: "view_intern", userId: intern.id }],
      });
    }

    // Inactive: open work exists, but no shift started in 3+ calendar days
    // — and the oldest open task is itself old enough that "just assigned,
    // hasn't started yet" isn't the more likely explanation.
    const lastSession = mySessions.reduce<WorkSession | null>((latest, s) => {
      const ts = new Date(s.startedAt).getTime();
      return !latest || ts > new Date(latest.startedAt).getTime() ? s : latest;
    }, null);
    const daysSinceLastShift = lastSession ? Math.floor((now - new Date(lastSession.startedAt).getTime()) / DAY_MS) : null;
    const oldestAssignedMs = Math.min(...openTasks.map((t) => (t.createdAt ? new Date(t.createdAt).getTime() : now)));
    const daysSinceAssigned = Math.floor((now - oldestAssignedMs) / DAY_MS);
    if (daysSinceAssigned >= 3 && (daysSinceLastShift === null || daysSinceLastShift >= 3)) {
      const days = daysSinceLastShift ?? daysSinceAssigned;
      signals.push({
        key: `inactive:${intern.id}`,
        type: "inactive",
        severity: days >= 5 ? "high" : "medium",
        headline: "No recent activity",
        description: lastSession
          ? `${intern.name} has open tasks but hasn't started a shift in ${days} day${days === 1 ? "" : "s"}.`
          : `${intern.name} has open tasks but has never started a shift.`,
        internId: intern.id,
        internName: intern.name,
        actions: [{ label: `Message ${intern.name}`, kind: "message", userId: intern.id }],
      });
    }

    // Unusual hours today: only evaluated once today's shift(s) are over
    // (a still-active shift isn't done accumulating yet, so comparing it
    // makes for a noisy, meaningless signal). Baseline is the average
    // worked-per-day over the prior 13 days, and only counted when there
    // are at least 3 prior worked days to average — otherwise there isn't
    // enough history to call anything "unusual" without fabricating one.
    const todaySessions = mySessions.filter((s) => localDayKey(new Date(s.startedAt)) === todayKey);
    const todayStillActive = todaySessions.some((s) => s.status === "active");
    if (todaySessions.length > 0 && !todayStillActive) {
      const todayTotal = todaySessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
      const priorByDay = new Map<string, number>();
      for (const s of mySessions) {
        const key = localDayKey(new Date(s.startedAt));
        if (key === todayKey || s.status !== "completed") continue;
        priorByDay.set(key, (priorByDay.get(key) ?? 0) + (s.durationSeconds ?? 0));
      }
      if (priorByDay.size >= 3) {
        const priorTotal = Array.from(priorByDay.values()).reduce((a, b) => a + b, 0);
        const avgPerDay = priorTotal / priorByDay.size;
        if (avgPerDay > 0) {
          const ratio = todayTotal / avgPerDay;
          if (ratio <= 0.4 || ratio >= 2) {
            signals.push({
              key: `unusual-hours:${intern.id}:${todayKey}`,
              type: "unusual_hours",
              severity: "medium",
              headline: ratio <= 0.4 ? "Worked less than usual today" : "Worked more than usual today",
              description: `${intern.name} logged ${Math.round(todayTotal / 60)}m today, vs. a ${Math.round(avgPerDay / 60)}m daily average over the prior ${priorByDay.size} worked days.`,
              internId: intern.id,
              internName: intern.name,
              actions: [{ label: `Message ${intern.name}`, kind: "message", userId: intern.id }],
            });
          }
        }
      }
    }
  }

  // Pending project proposals awaiting admin review for 24h+.
  for (const project of projects) {
    if ((project as any).status !== "pending_approval") continue;
    const createdAt = (project as any).createdAt;
    if (!createdAt) continue;
    const hours = Math.floor((now - new Date(createdAt).getTime()) / HOUR_MS);
    if (hours < 24) continue;
    const intern = interns.find((i) => i.id === (project as any).internId);
    const days = Math.max(1, Math.floor(hours / 24));
    signals.push({
      key: `proposal:${project.id}`,
      type: "pending_proposal",
      severity: hours >= 72 ? "high" : "medium",
      headline: "Pending manager action",
      description: `Project proposal "${(project as any).title}"${intern ? ` from ${intern.name}` : ""} has been awaiting review for ${days} day${days === 1 ? "" : "s"}.`,
      projectId: project.id,
      internId: intern?.id,
      internName: intern?.name,
      actions: [{ label: "Review Proposal", kind: "view_project", projectId: project.id }],
    });
  }

  const severityRank = { high: 0, medium: 1 } as const;
  return signals.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
