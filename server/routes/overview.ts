import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, clampInt } from "../routes";
import { buildOrgContext, collectApprovals, isOverdue, dueWithin, secondsToday, hoursThisWeek } from "../services/orgContext";
import { computeNextBestAction } from "../services/nextBestAction";
import { summarizeSessions } from "../services/worktime";

// Dashboard overview endpoints. Both answer one question — "what matters
// right now?" — from a single context build, so the home screen is one
// request instead of eight polled ones.
export function registerOverviewRoutes(app: Express) {
  app.get("/api/overview", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).companyId as string;
      const tz = clampInt(req.query.tzOffsetMinutes, 0, -720, 840);
      const ctx = await buildOrgContext(companyId, { tzOffsetMinutes: tz });
      const approvals = await collectApprovals(ctx);
      const company = await storage.getCompanyById(companyId);

      const working = ctx.activeSessions.map((s) => {
        const p = ctx.internById.get(s.internId);
        const live = ctx.liveActivityByInternId.get(s.internId);
        const current = ctx.tasks.filter((t) => t.assigneeId === s.internId && t.status === "in_progress")
          .sort((a, b) => new Date(b.startedAt || b.updatedAt || 0).getTime() - new Date(a.startedAt || a.updatedAt || 0).getTime())[0];
        const observedAgoSeconds = live ? Math.max(0, Math.round((ctx.now.getTime() - new Date(live.observedAt).getTime()) / 1000)) : null;
        return {
          sessionId: s.id, personId: s.internId, name: p?.name ?? "Unknown",
          startedAt: s.startedAt, elapsedSeconds: Math.round((ctx.now.getTime() - new Date(s.startedAt).getTime()) / 1000),
          currentTask: current ? { id: current.id, title: current.title } : null,
          // "connected" = the Companion reported within the last 2 minutes;
          // "stale" = it has reported this session but not recently;
          // "none" = nothing observed this session.
          companion: live ? (observedAgoSeconds! <= 120 ? "connected" : "stale") : "none",
          lastObserved: live ? { application: live.application, context: live.context, at: live.observedAt, idleSeconds: live.idleSeconds } : null,
        };
      });

      const overdue = ctx.tasks.filter((t) => isOverdue(t, ctx.now)).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
      const blocked = ctx.tasks.filter((t) => t.status === "blocked");
      const dueSoon = ctx.tasks.filter((t) => dueWithin(t, ctx.now, 3)).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
      const asTask = (t: typeof ctx.tasks[number]) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, assigneeId: t.assigneeId, assigneeName: ctx.internById.get(t.assigneeId)?.name ?? "Unknown", blockedReason: t.blockedReason, projectId: t.projectId, updatedAt: t.updatedAt });

      // Recent activity feed: a merge of real events, newest first.
      const feed: { ts: string; kind: string; label: string; href: string; personId?: string; personName?: string }[] = [];
      for (const s of ctx.recentSubmissions.slice(0, 15)) {
        const t = ctx.taskById.get(s.taskId); const p = ctx.internById.get(s.internId);
        feed.push({ ts: s.submittedAt as unknown as string, kind: "submitted", label: `${p?.name ?? "Someone"} submitted "${t?.title ?? "a task"}"`, href: `/tasks/${s.taskId}`, personId: s.internId, personName: p?.name });
      }
      for (const t of ctx.tasks.filter((t) => t.completedAt && new Date(t.completedAt) >= new Date(ctx.now.getTime() - 7 * 86_400_000))) {
        feed.push({ ts: t.completedAt as unknown as string, kind: "approved", label: `"${t.title}" was approved`, href: `/tasks/${t.id}`, personId: t.assigneeId, personName: ctx.internById.get(t.assigneeId)?.name });
      }
      for (const t of ctx.tasks.filter((t) => t.startedAt && new Date(t.startedAt) >= new Date(ctx.now.getTime() - 7 * 86_400_000))) {
        feed.push({ ts: t.startedAt as unknown as string, kind: "started", label: `${ctx.internById.get(t.assigneeId)?.name ?? "Someone"} started "${t.title}"`, href: `/tasks/${t.id}`, personId: t.assigneeId });
      }
      for (const s of ctx.recentSessions.filter((s) => s.status === "completed").slice(0, 10)) {
        const p = ctx.internById.get(s.internId);
        feed.push({ ts: (s.endedAt ?? s.startedAt) as unknown as string, kind: "shift", label: `${p?.name ?? "Someone"} ended a ${Math.round((s.durationSeconds ?? 0) / 60)}m session`, href: `/work/replay/${s.id}`, personId: s.internId, personName: p?.name });
      }
      feed.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

      const people = ctx.interns.map((i) => {
        const mine = ctx.tasks.filter((t) => t.assigneeId === i.id);
        return {
          id: i.id, name: i.name,
          working: ctx.activeSessions.some((s) => s.internId === i.id),
          openTasks: mine.filter((t) => t.status !== "completed").length,
          overdue: mine.filter((t) => isOverdue(t, ctx.now)).length,
          blocked: mine.filter((t) => t.status === "blocked").length,
          inReview: mine.filter((t) => t.status === "in_review").length,
          secondsToday: secondsToday(ctx, i.id),
          hoursWeek: hoursThisWeek(ctx, i.id),
          signals: ctx.signals.filter((s) => s.internId === i.id).length,
        };
      });

      const todayTotalSeconds = summarizeSessions(ctx.todaySessions, ctx.now).totalSeconds;
      const onboarding = {
        dismissed: !!company?.onboardingDismissedAt,
        steps: {
          invitedIntern: ctx.interns.length > 0,
          createdProject: ctx.projects.length > 0,
          createdTask: ctx.tasks.length > 0,
          firstSession: ctx.recentSessions.length > 0 || (await storage.getWorkSessionsByCompanySince(companyId, new Date(0))).length > 0,
          companionActivity: ctx.todayActivityByInternId.size > 0 || (await storage.getWorkActivitiesBySessions(ctx.recentSessions.map((s) => s.id))).length > 0,
        },
      };

      res.json({
        now: ctx.now, company: { id: companyId, name: ctx.company.name, acceptingApplications: company?.acceptingApplications ?? false, slug: company?.slug ?? null },
        counts: {
          interns: ctx.interns.length, working: ctx.activeSessions.length, overdue: overdue.length, blocked: blocked.length,
          inReview: ctx.tasks.filter((t) => t.status === "in_review").length, approvals: approvals.length, signals: ctx.signals.length,
          openTasks: ctx.tasks.filter((t) => t.status !== "completed").length, dueSoon: dueSoon.length, todaySeconds: todayTotalSeconds,
          submissionsToday: ctx.recentSubmissions.filter((s) => new Date(s.submittedAt) >= ctx.todayStart).length,
        },
        working, approvals: approvals.slice(0, 12), signals: ctx.signals.slice(0, 12),
        overdue: overdue.slice(0, 8).map(asTask), blocked: blocked.slice(0, 8).map(asTask), dueSoon: dueSoon.slice(0, 8).map(asTask),
        feed: feed.slice(0, 20), people, onboarding,
        projects: ctx.projects.filter((p) => p.status !== "rejected").map((p) => {
          const pt = ctx.tasks.filter((t) => t.projectId === p.id);
          return { id: p.id, title: p.title, status: p.status, ownerId: p.internId, ownerName: ctx.internById.get(p.internId)?.name ?? "Unknown", tasks: pt.length, done: pt.filter((t) => t.status === "completed").length, overdue: pt.filter((t) => isOverdue(t, ctx.now)).length, blocked: pt.filter((t) => t.status === "blocked").length };
        }),
      });
    } catch (error) {
      console.error("Overview failed:", error);
      res.status(500).json({ message: "Couldn't load the overview." });
    }
  });

  app.get("/api/me/overview", requireAuth, requireRole("intern"), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const companyId = (req as any).companyId as string;
      const tz = clampInt(req.query.tzOffsetMinutes, 0, -720, 840);
      const now = new Date();
      const { startOfToday, startOfWeek } = await import("../services/worktime");
      const [user, myTasks, companyTasks, projects, active, todaySessions, weekSessions, notifications] = await Promise.all([
        storage.getUser(userId),
        storage.getTasksByAssignee(userId),
        storage.getTasksByCompany(companyId),
        storage.getProjectsByIntern(userId),
        storage.getActiveWorkSession(userId),
        storage.getWorkSessionsByInternSince(userId, startOfToday(now, tz)),
        storage.getWorkSessionsByInternSince(userId, startOfWeek(now, tz)),
        storage.getNotificationsByUser(userId, 8),
      ]);
      const { recommended, alternates } = computeNextBestAction(myTasks, companyTasks, tz);
      const live = active ? await storage.getLatestWorkActivityForSession(active.id) : undefined;
      const observedAgo = live ? Math.round((now.getTime() - new Date(live.endedAt).getTime()) / 1000) : null;
      const asTask = (t: typeof myTasks[number]) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, projectId: t.projectId, blockedReason: t.blockedReason, feedback: t.feedback, submittedAt: t.submittedAt, startedAt: t.startedAt, updatedAt: t.updatedAt });
      const open = myTasks.filter((t) => t.status !== "completed");
      res.json({
        now, user: user ? { id: user.id, name: user.name } : null,
        workMode: active ? {
          sessionId: active.id, startedAt: active.startedAt,
          elapsedSeconds: Math.round((now.getTime() - new Date(active.startedAt).getTime()) / 1000),
          companion: live ? (observedAgo! <= 120 ? "connected" : "stale") : "none",
          lastObserved: live ? { application: live.application, context: live.documentName || live.browserDomain || null, at: live.endedAt } : null,
        } : null,
        time: { today: summarizeSessions(todaySessions, now), week: summarizeSessions(weekSessions, now) },
        priority: recommended ? { task: asTask(recommended.task), reason: recommended.reason } : null,
        alternates: alternates.slice(0, 3).map(asTask),
        today: open.filter((t) => t.status === "in_progress" || dueWithin(t, now, 0) || isOverdue(t, now)).map(asTask),
        upcoming: open.filter((t) => t.dueDate && !isOverdue(t, now) && !dueWithin(t, now, 0)).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 6).map(asTask),
        inReview: open.filter((t) => t.status === "in_review").map(asTask),
        blocked: open.filter((t) => t.status === "blocked").map(asTask),
        feedback: myTasks.filter((t) => t.feedback && (t.status === "in_progress" || t.status === "completed")).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()).slice(0, 4).map(asTask),
        recentlyCompleted: myTasks.filter((t) => t.status === "completed").sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()).slice(0, 5).map(asTask),
        projects: projects.map((p) => ({ id: p.id, title: p.title, status: p.status, tasks: myTasks.filter((t) => t.projectId === p.id).length, done: myTasks.filter((t) => t.projectId === p.id && t.status === "completed").length })),
        counts: { open: open.length, overdue: open.filter((t) => isOverdue(t, now)).length, inReview: open.filter((t) => t.status === "in_review").length, blocked: open.filter((t) => t.status === "blocked").length, completed: myTasks.length - open.length },
        notifications: notifications.slice(0, 6),
      });
    } catch (error) {
      console.error("Intern overview failed:", error);
      res.status(500).json({ message: "Couldn't load your overview." });
    }
  });

  app.post("/api/onboarding/dismiss", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await storage.setCompanyOnboardingDismissed((req as any).companyId, req.body?.dismissed !== false);
      res.json({ ok: true });
    } catch (error) {
      console.error("Onboarding dismiss failed:", error);
      res.status(500).json({ message: "Couldn't update the checklist." });
    }
  });
}
