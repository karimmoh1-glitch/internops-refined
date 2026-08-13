import type { Task } from "@shared/schema";

// Purely rule-based on current task columns — no AI judgment. A
// hallucinated "at risk" flag on a real person is actively harmful in a
// way a wrong chat answer isn't, and every signal needed already exists
// on the current schema (status, dueDate, updatedAt, blockedReason).

export interface RiskFlag {
  internId: string;
  internName: string;
  reason: string;
  severity: "high" | "medium";
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function daysAgo(date: Date, now: number): number {
  return Math.floor((now - date.getTime()) / DAY_MS);
}

// Counts business days (Mon-Fri) between two timestamps — used for the
// "gone quiet" signal so a normal weekend doesn't itself trigger a flag.
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

export function computeRiskFlags(
  interns: { id: string; name: string }[],
  tasks: Task[],
): RiskFlag[] {
  const now = Date.now();
  const flags: RiskFlag[] = [];

  for (const intern of interns) {
    const internTasks = tasks.filter((t) => t.assigneeId === intern.id);
    if (internTasks.length === 0) continue;

    let best: RiskFlag | null = null;
    const consider = (reason: string, severity: "high" | "medium") => {
      if (!best || (severity === "high" && best.severity !== "high")) {
        best = { internId: intern.id, internName: intern.name, reason, severity };
      }
    };

    for (const task of internTasks) {
      if (task.status === "blocked") {
        const since = task.updatedAt ? new Date(task.updatedAt) : null;
        if (since && now - since.getTime() > 48 * HOUR_MS) {
          const days = daysAgo(since, now);
          consider(`Blocked on "${task.title}" for ${days} day${days === 1 ? "" : "s"}`, "high");
        }
      }

      if (task.dueDate && task.status !== "completed") {
        const due = new Date(task.dueDate);
        if (due.getTime() < now) {
          const days = daysAgo(due, now);
          if (days > 3) {
            consider(`"${task.title}" overdue by ${days} days`, "high");
          } else {
            consider(`"${task.title}" overdue by ${days} day${days === 1 ? "" : "s"}`, "medium");
          }
        }
      }
    }

    const hasOpenWork = internTasks.some((t) => t.status !== "completed");
    if (hasOpenWork) {
      const mostRecentUpdate = internTasks.reduce<Date | null>((latest, t) => {
        const ts = t.updatedAt ? new Date(t.updatedAt) : null;
        if (!ts) return latest;
        return !latest || ts > latest ? ts : latest;
      }, null);
      if (mostRecentUpdate && businessDaysSince(mostRecentUpdate, now) >= 5) {
        consider(`No activity in ${businessDaysSince(mostRecentUpdate, now)} business days`, "medium");
      }
    }

    if (best) flags.push(best);
  }

  return flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}
