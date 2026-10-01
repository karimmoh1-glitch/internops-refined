import type { Express, Request } from "express";
import { storage } from "../storage";
import { requireAuth } from "../routes";

// Global search. Grouped by type; every group is scoped to what the caller
// may see (an intern only ever gets their own tasks/projects, the channels
// they're in, and no applications/alumni).
export function registerSearchRoutes(app: Express) {
  app.get("/api/search", requireAuth, async (req: Request, res) => {
    try {
      const q = String(req.query.q ?? "").trim().slice(0, 80);
      const role = (req as any).userRole as string;
      const userId = (req as any).userId as string;
      const companyId = (req as any).companyId as string | null;
      if (!companyId || q.length < 2) return res.json({ query: q, groups: [] });
      const isAdmin = role === "admin";

      const [tasks, projects, people, messages, applications, alumni] = await Promise.all([
        storage.searchTasks(companyId, q, isAdmin ? null : userId),
        storage.searchProjects(companyId, q, isAdmin ? null : userId),
        isAdmin ? storage.searchUsers(companyId, q) : Promise.resolve([]),
        storage.searchChannelMessages(userId, q),
        isAdmin ? storage.searchApplications(companyId, q) : Promise.resolve([]),
        isAdmin ? storage.searchAlumni(companyId, q) : Promise.resolve([]),
      ]);

      const assigneeIds = Array.from(new Set(tasks.map((t) => t.assigneeId)));
      const assignees = await Promise.all(assigneeIds.map((id) => storage.getUser(id)));
      const nameById = new Map(assignees.filter(Boolean).map((u) => [u!.id, u!.name]));

      const groups = [
        { type: "task", label: "Tasks", items: tasks.map((t) => ({ id: t.id, title: t.title, subtitle: `${nameById.get(t.assigneeId) ?? "Unassigned"} · ${t.status.replace("_", " ")}`, href: `/tasks/${t.id}`, meta: { status: t.status, priority: t.priority } })) },
        { type: "project", label: "Projects", items: projects.map((p) => ({ id: p.id, title: p.title, subtitle: p.status.replace("_", " "), href: `/projects/${p.id}`, meta: { status: p.status } })) },
        { type: "person", label: "People", items: people.filter((u) => !u.alumniAt).map((u) => ({ id: u.id, title: u.name, subtitle: u.role === "admin" ? "Manager" : u.deactivatedAt ? "Deactivated" : "Intern", href: u.role === "admin" ? `/people?tab=managers` : `/people/${u.id}`, meta: { role: u.role } })) },
        { type: "message", label: "Messages", items: messages.map((m) => ({ id: m.id, title: m.content.length > 90 ? m.content.slice(0, 90) + "…" : m.content, subtitle: `${m.userName} in ${m.channelType === "dm" ? "a direct message" : "#" + m.channelName}`, href: `/messages/${m.channelId}`, meta: {} })) },
        { type: "application", label: "Applications", items: applications.map((a) => ({ id: a.id, title: a.name, subtitle: `${a.email} · ${a.status.replace("_", " ")}`, href: `/people?tab=applications`, meta: { status: a.status } })) },
        { type: "alumni", label: "Alumni", items: alumni.map((u) => ({ id: u.id, title: u.name, subtitle: "Alumni", href: `/people/${u.id}`, meta: {} })) },
      ].filter((g) => g.items.length > 0);

      res.json({ query: q, groups });
    } catch (error) {
      console.error("Search failed:", error);
      res.status(500).json({ message: "Search is unavailable right now." });
    }
  });
}
