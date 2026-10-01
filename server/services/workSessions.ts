import { storage } from "../storage";
import { summarizeActivityByCategory } from "./workJournal";
import { computeNextBestAction } from "./nextBestAction";
import { tasksInWindow } from "./worktime";
import type { WorkSession, WorkSummary } from "@shared/schema";

// A shift nobody ended is closed by the server after this long. Long
// enough that a genuine marathon day is never cut short; short enough
// that a forgotten shift can't inflate "hours today" for a week.
export const MAX_SHIFT_HOURS = 16;

// Everything in the generated report is computed from stored data —
// activity rollups, real task timestamps, the next-best-action engine —
// never written by an LLM. Idempotent: a session that already has a
// summary just returns it, so a retry (or the sweep racing a manual End)
// can never produce two reports for one shift.
export async function finalizeWorkSession(ended: WorkSession): Promise<WorkSummary> {
  const existing = await storage.getWorkSummaryBySession(ended.id);
  if (existing) return existing;

  const [myTasks, companyTasks] = await Promise.all([
    storage.getTasksByAssignee(ended.internId),
    storage.getTasksByCompany(ended.companyId),
  ]);
  const start = new Date(ended.startedAt);
  const end = new Date((ended.endedAt ?? new Date()) as Date);
  const approved = tasksInWindow(myTasks, start, end, "completedAt");
  const submitted = await storage.getTaskSubmissionsByInternInWindow(ended.internId, start, end);

  const [activityRows, activities] = await Promise.all([
    storage.getWorkActivityBreakdownBySession(ended.id),
    storage.getWorkActivitiesBySession(ended.id),
  ]);
  const activityBreakdown = summarizeActivityByCategory(activityRows);

  // Primary project: the one most represented in task-correlated activity
  // (observed), else the project of whatever was submitted most recently
  // in the window.
  const projectSeconds = new Map<string, number>();
  for (const a of activities) {
    if (a.projectId) projectSeconds.set(a.projectId, (projectSeconds.get(a.projectId) ?? 0) + a.durationSeconds);
  }
  let primaryProjectId: string | null = null;
  if (projectSeconds.size > 0) {
    primaryProjectId = Array.from(projectSeconds.entries()).sort((a, b) => b[1] - a[1])[0][0];
  } else {
    const submittedTaskIds = new Set(submitted.map((s) => s.taskId));
    const touched = myTasks.filter((t) => submittedTaskIds.has(t.id) || approved.some((a) => a.id === t.id))
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0];
    primaryProjectId = touched?.projectId ?? null;
  }

  const { recommended } = computeNextBestAction(myTasks, companyTasks);
  const nextStep = recommended ? `Continue "${recommended.task.title}"` : null;

  try {
    return await storage.createWorkSummary({
      sessionId: ended.id,
      internId: ended.internId,
      companyId: ended.companyId,
      durationSeconds: ended.durationSeconds ?? 0,
      primaryProjectId,
      activityBreakdown,
      tasksCompleted: approved.length,
      tasksSubmitted: new Set(submitted.map((s) => s.taskId)).size,
      nextStep,
    });
  } catch (err) {
    // Unique(sessionId) — a concurrent finalize won. Return theirs.
    const again = await storage.getWorkSummaryBySession(ended.id);
    if (again) return again;
    throw err;
  }
}

// Ends any shift the server considers abandoned. Each closed session gets
// a report like any other, plus endReason="auto_timeout" so Replay and the
// intern both see it was the server, not them, that ended it.
export async function sweepAbandonedShifts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - MAX_SHIFT_HOURS * 60 * 60 * 1000);
  const stale = await storage.getActiveWorkSessionsOlderThan(cutoff);
  let closed = 0;
  for (const session of stale) {
    const ended = await storage.endWorkSessionById(session.id, "auto_timeout", null, now);
    if (!ended) continue;
    closed++;
    await finalizeWorkSession(ended);
    await storage.createNotification({
      userId: ended.internId,
      title: "Your shift was closed automatically",
      message: `A Work Mode session that started ${new Date(ended.startedAt).toLocaleString()} was still open after ${MAX_SHIFT_HOURS} hours, so it was ended for you.`,
      read: false,
      link: `/work/replay/${ended.id}`,
    });
  }
  return closed;
}

// Used when an account changes state (deactivated, promoted, moved to
// alumni) while a shift is open: the shift is ended honestly with the
// reason recorded, never left dangling as "active" forever.
export async function endShiftForAccountChange(internId: string, actorUserId: string | null): Promise<WorkSession | null> {
  const ended = await storage.endWorkSession(internId, "account", actorUserId);
  if (!ended) return null;
  await finalizeWorkSession(ended);
  return ended;
}
