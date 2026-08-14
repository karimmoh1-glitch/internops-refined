import type { Task, Project } from "@shared/schema";

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
  | "project_at_risk";

export interface SignalAction {
  label: string;
  kind: "view_task" | "view_project" | "message" | "review";
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
