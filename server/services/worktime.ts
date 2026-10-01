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

// Calendar boundaries in the CLIENT's timezone. tzOffsetMinutes is the
// browser's Date.getTimezoneOffset() (minutes to add to local time to reach
// UTC). The server runs in UTC, so without this "today" could start up to
// 14 hours away from what the person looking at the screen calls today.
export function startOfToday(now: Date = new Date(), tzOffsetMinutes = 0): Date {
  const shifted = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const localMidnightUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(localMidnightUtc + tzOffsetMinutes * 60_000);
}

// Monday-start week, in the client's timezone.
export function startOfWeek(now: Date = new Date(), tzOffsetMinutes = 0): Date {
  const today = startOfToday(now, tzOffsetMinutes);
  const shifted = new Date(today.getTime() - tzOffsetMinutes * 60_000);
  const day = shifted.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  return new Date(today.getTime() - diff * 24 * 60 * 60_000);
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
