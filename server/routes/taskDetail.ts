import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, logAudit } from "../routes";
import { buildActivitySegments } from "../services/workJournal";

async function loadTaskForCaller(req: Request) {
  const task = await storage.getTaskById(req.params.id as string);
  if (!task || task.companyId !== (req as any).companyId) return null;
  if ((req as any).userRole !== "admin" && task.assigneeId !== (req as any).userId) return null;
  return task;
}

// Everything the task page needs in one request: the task, the people
// around it, the full submission history, the discussion thread, the
// Work Mode evidence correlated with it, and its dependency links.
export function registerTaskDetailRoutes(app: Express) {
  app.get("/api/tasks/:id/detail", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await loadTaskForCaller(req);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const [assignee, creator, project, submissions, comments, activities, dependents, upstream] = await Promise.all([
        storage.getUser(task.assigneeId),
        task.createdByUserId ? storage.getUser(task.createdByUserId) : Promise.resolve(undefined),
        task.projectId ? storage.getProjectById(task.projectId) : Promise.resolve(undefined),
        storage.getTaskSubmissionsByTask(task.id),
        storage.getTaskComments(task.id),
        storage.getWorkActivitiesByTask(task.id),
        storage.getTasksDependingOn(task.id),
        task.dependsOnTaskId ? storage.getTaskById(task.dependsOnTaskId) : Promise.resolve(undefined),
      ]);
      const segments = buildActivitySegments(activities as any);
      const sessionIds = Array.from(new Set(activities.map((a) => a.sessionId)));
      const sessions = await Promise.all(sessionIds.map((id) => storage.getWorkSessionById(id)));
      const evidence = {
        totalSeconds: activities.reduce((sum, a) => sum + a.durationSeconds, 0),
        sessions: sessions.filter(Boolean).map((s) => ({ id: s!.id, startedAt: s!.startedAt, endedAt: s!.endedAt, seconds: activities.filter((a) => a.sessionId === s!.id).reduce((sum, a) => sum + a.durationSeconds, 0) })),
        segments: segments.slice(0, 20).map((seg) => ({ startedAt: seg.startedAt, endedAt: seg.endedAt, durationSeconds: seg.durationSeconds, label: seg.label, application: seg.application, category: seg.category, contextStatus: seg.contextStatus })),
      };
      // Activity timeline for the task itself, assembled from real timestamps.
      const history: { ts: string; kind: string; label: string; by?: string }[] = [];
      if (task.createdAt) history.push({ ts: task.createdAt as unknown as string, kind: "created", label: `Created${creator ? ` by ${creator.name}` : ""}`, by: creator?.name });
      if (task.startedAt) history.push({ ts: task.startedAt as unknown as string, kind: "started", label: `Started by ${assignee?.name ?? "assignee"}` });
      for (const s of submissions) history.push({ ts: s.submittedAt as unknown as string, kind: "submitted", label: "Submitted for review" });
      if (task.feedback && task.status === "in_progress") history.push({ ts: task.updatedAt as unknown as string, kind: "changes_requested", label: "Changes requested" });
      if (task.status === "blocked" && task.updatedAt) history.push({ ts: task.updatedAt as unknown as string, kind: "blocked", label: `Blocked: ${task.blockedReason ?? ""}` });
      if (task.completedAt) history.push({ ts: task.completedAt as unknown as string, kind: "approved", label: "Approved" });
      for (const c of comments) history.push({ ts: c.createdAt as unknown as string, kind: "comment", label: `${c.authorName ?? "Someone"} commented`, by: c.authorName ?? undefined });
      history.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

      res.json({
        task,
        assignee: assignee ? { id: assignee.id, name: assignee.name, role: assignee.role } : null,
        creator: creator ? { id: creator.id, name: creator.name } : null,
        project: project ? { id: project.id, title: project.title, status: project.status } : null,
        submissions, comments, evidence, history,
        dependents: dependents.map((t) => ({ id: t.id, title: t.title, status: t.status })),
        upstream: upstream ? { id: upstream.id, title: upstream.title, status: upstream.status } : null,
      });
    } catch (error) {
      console.error("Task detail failed:", error);
      res.status(500).json({ message: "Couldn't load this task." });
    }
  });

  app.post("/api/tasks/:id/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await loadTaskForCaller(req);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const content = typeof req.body?.content === "string" ? req.body.content.trim().slice(0, 4000) : "";
      if (!content) return res.status(400).json({ message: "Write something first." });
      const userId = (req as any).userId as string;
      const author = await storage.getUser(userId);
      const comment = await storage.createTaskComment({ taskId: task.id, companyId: task.companyId, authorUserId: userId, content });
      // Notify the other side of the conversation: the assignee when a
      // manager writes, every admin when the assignee writes.
      if (userId !== task.assigneeId) {
        await storage.createNotification({ userId: task.assigneeId, title: "New comment on your task", message: `${author?.name ?? "A manager"} on "${task.title}": ${content.slice(0, 120)}`, read: false, link: `/tasks/${task.id}` });
      } else {
        const admins = await storage.getAdminsByCompany(task.companyId);
        for (const a of admins) {
          await storage.createNotification({ userId: a.id, title: "New comment on a task", message: `${author?.name ?? "An intern"} on "${task.title}": ${content.slice(0, 120)}`, read: false, link: `/tasks/${task.id}` });
        }
      }
      await logAudit({ actorUserId: userId, companyId: task.companyId, action: "task.commented", targetType: "task", targetId: task.id });
      res.status(201).json({ ...comment, authorName: author?.name ?? null, authorRole: author?.role ?? null });
    } catch (error) {
      console.error("Task comment failed:", error);
      res.status(500).json({ message: "Couldn't post your comment." });
    }
  });
}
