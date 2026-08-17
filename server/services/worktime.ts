import type { WorkSession, Task } from "@shared/schema";

export interface WorktimeSummary {
  totalSeconds: number;
  sessionCount: number;
  avgSessionSeconds: number;
}

// Completed sessions count their stored duration; an active session counts
// its elapsed-so-far time as of `now` so "today's hours" ticks up live
// instead of only updating once a shift ends.
export function summarizeSessions(sessions: WorkSession[], now: Date = new Date()): WorktimeSummary {
  let totalSeconds = 0;
  let sessionCount = 0;
  for (const s of sessions) {
    if (s.status === "completed" && s.durationSeconds != null) {
      totalSeconds += s.durationSeconds;
      sessionCount++;
    } else if (s.status === "active") {
      totalSeconds += Math.max(0, Math.round((now.getTime() - new Date(s.startedAt).getTime()) / 1000));
      sessionCount++;
    }
  }
  return {
    totalSeconds,
    sessionCount,
    avgSessionSeconds: sessionCount > 0 ? Math.round(totalSeconds / sessionCount) : 0,
  };
}

export function startOfToday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Monday-start week.
export function startOfWeek(now: Date = new Date()): Date {
  const d = startOfToday(now);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

// Tasks whose given timestamp field falls inside [start, end] — used both
// for the end-shift summary ("what did this session accomplish") and the
// admin activity timeline ("what happened during this window").
export function tasksInWindow(tasks: Task[], start: Date, end: Date, field: "completedAt" | "submittedAt" | "startedAt"): Task[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return tasks.filter((t) => {
    const ts = (t as any)[field];
    if (!ts) return false;
    const time = new Date(ts).getTime();
    return time >= startMs && time <= endMs;
  });
}
