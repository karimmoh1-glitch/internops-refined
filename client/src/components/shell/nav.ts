import { LayoutDashboard, ListTodo, FolderKanban, Users, Timer, Radar, Sparkles, MessageSquare, Settings } from "lucide-react";

export interface NavItem { href: string; label: string; icon: typeof LayoutDashboard; roles: ("admin" | "intern")[]; group: "work" | "team" | "system"; match?: (path: string) => boolean }

export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard, roles: ["admin", "intern"], group: "work", match: (p) => p === "/" },
  { href: "/tasks", label: "Tasks", icon: ListTodo, roles: ["admin", "intern"], group: "work" },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["admin", "intern"], group: "work" },
  { href: "/work", label: "Work", icon: Timer, roles: ["admin", "intern"], group: "work" },
  { href: "/people", label: "People", icon: Users, roles: ["admin"], group: "team" },
  { href: "/signals", label: "Signals", icon: Radar, roles: ["admin"], group: "team" },
  { href: "/pulse", label: "Pulse", icon: Sparkles, roles: ["admin", "intern"], group: "team" },
  { href: "/messages", label: "Messages", icon: MessageSquare, roles: ["admin", "intern"], group: "team" },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "intern"], group: "system" },
];

export function isActive(item: NavItem, path: string): boolean {
  if (item.match) return item.match(path);
  return path === item.href || path.startsWith(item.href + "/");
}
