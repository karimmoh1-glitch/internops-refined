import { LayoutDashboard, ListTodo, FolderKanban, Users, Timer, Radar, Sparkles, MessageSquare, Settings, GraduationCap, Lightbulb } from "lucide-react";

export type NavGroup = "workspace" | "intelligence" | "organization" | "system";
export interface NavItem { href: string; label: string; icon: typeof LayoutDashboard; roles: ("admin" | "intern")[]; group: NavGroup; match?: (path: string, search: string) => boolean }

export const NAV_GROUP_LABEL: Record<NavGroup, string | null> = { workspace: null, intelligence: "Intelligence", organization: "Organization", system: null };

export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard, roles: ["admin", "intern"], group: "workspace", match: (p) => p === "/" },
  { href: "/tasks", label: "Tasks", icon: ListTodo, roles: ["admin", "intern"], group: "workspace" },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["admin", "intern"], group: "workspace", match: (p, s) => (p === "/projects" || p.startsWith("/projects/")) && !/filter=proposals/.test(s) },
  { href: "/people", label: "People", icon: Users, roles: ["admin"], group: "workspace", match: (p, s) => (p === "/people" || p.startsWith("/people/")) && !/tab=alumni/.test(s) },
  { href: "/work", label: "Work", icon: Timer, roles: ["admin", "intern"], group: "workspace" },
  { href: "/signals", label: "Signals", icon: Radar, roles: ["admin"], group: "intelligence" },
  { href: "/pulse", label: "Pulse", icon: Sparkles, roles: ["admin", "intern"], group: "intelligence" },
  { href: "/messages", label: "Messages", icon: MessageSquare, roles: ["admin", "intern"], group: "intelligence" },
  { href: "/projects?filter=proposals", label: "Proposals", icon: Lightbulb, roles: ["admin"], group: "organization", match: (p, s) => p === "/projects" && /filter=proposals/.test(s) },
  { href: "/people?tab=alumni", label: "Alumni", icon: GraduationCap, roles: ["admin"], group: "organization", match: (p, s) => p === "/people" && /tab=alumni/.test(s) },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "intern"], group: "system" },
];

export function isActive(item: NavItem, path: string, search = ""): boolean {
  if (item.match) return item.match(path, search);
  return path === item.href || path.startsWith(item.href + "/");
}
