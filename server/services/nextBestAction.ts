import type { Task } from "@shared/schema";

// "What should I work on?" — a recommendation, never a command. Purely
// rule-based over the intern's own real task data (deadline, priority,
// overdue-ness, whether the task blocks other work) — never randomly
// selected, never an invented priority.

export interface NextBestAction {
  task: Task;
  reason: string;
  blockingCount: number;
}

function calendarDaysUntil(dueDate: Date, now: Date): number {
  const dueDay = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((dueDay - today) / (24 * 60 * 60 * 1000));
}

const PRIORITY_WEIGHT: Record<string, number> = { high: 30, medium: 15, low: 5 };

export function computeNextBestAction(
  myTasks: Task[],
  companyTasks: Task[],
): { recommended: NextBestAction | null; alternates: Task[] } {
  const now = new Date();
  const dependentCounts = new Map<string, number>();
  for (const t of companyTasks) {
    if (t.dependsOnTaskId) {
      dependentCounts.set(t.dependsOnTaskId, (dependentCounts.get(t.dependsOnTaskId) ?? 0) + 1);
    }
  }

  const actionable = myTasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  if (actionable.length === 0) return { recommended: null, alternates: [] };

  const scored = actionable.map((task) => {
    let score = 0;
    const reasons: string[] = [];

    score += PRIORITY_WEIGHT[task.priority] ?? 10;
    if (task.priority === "high") reasons.push("high priority");

    if (task.dueDate) {
      const days = calendarDaysUntil(new Date(task.dueDate), now);
      if (days < 0) {
        score += 100 + Math.min(-days, 10) * 5;
        reasons.push(`overdue by ${-days} day${-days === 1 ? "" : "s"}`);
      } else if (days === 0) {
        score += 80;
        reasons.push("due today");
      } else if (days === 1) {
        score += 60;
        reasons.push("due tomorrow");
      } else if (days <= 3) {
        score += 40;
        reasons.push(`due in ${days} days`);
      } else if (days <= 7) {
        score += 15;
      }
    }

    const blockingCount = dependentCounts.get(task.id) ?? 0;
    if (blockingCount > 0) {
      score += 25 * blockingCount;
      reasons.push(blockingCount === 1 ? "blocking another task" : `blocking ${blockingCount} other tasks`);
    }

    if (task.status === "in_progress") {
      score += 10;
      reasons.push("already in progress");
    }

    return { task, score, reasons, blockingCount };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  let reason: string;
  if (top.reasons.length === 0) {
    reason = "Next up in your task list.";
  } else if (top.reasons.length === 1) {
    reason = `Recommended because it is ${top.reasons[0]}.`;
  } else {
    const last = top.reasons[top.reasons.length - 1];
    const rest = top.reasons.slice(0, -1).join(", ");
    reason = `Recommended because it is ${rest} and ${last}.`;
  }

  return {
    recommended: { task: top.task, reason, blockingCount: top.blockingCount },
    alternates: scored.slice(1).map((s) => s.task),
  };
}
