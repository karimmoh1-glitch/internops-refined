import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { api, tzOffset } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { NAV } from "./nav";
import { Kbd } from "@/components/kit";
import { Search, Plus, Play, Square, UserPlus, ListTodo, FolderKanban, User, MessageSquare, FileText, GraduationCap, Sparkles, Moon, Sun, Laptop, LogOut, Download } from "lucide-react";
import { useTheme } from "@/lib/theme";

const RECENT_KEY = "internops_recent_searches";
function readRecent(): string[] { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; } }
function pushRecent(q: string) { try { const r = [q, ...readRecent().filter((x) => x !== q)].slice(0, 6); localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch { /* ignore */ } }

const GROUP_ICON: Record<string, typeof ListTodo> = { task: ListTodo, project: FolderKanban, person: User, message: MessageSquare, application: FileText, alumni: GraduationCap };

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("internops:open-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("internops:open-palette", onOpen); };
  }, []);
  return { open, setOpen };
}

export function openCommandPalette() { window.dispatchEvent(new CustomEvent("internops:open-palette")); }

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { setPreference } = useTheme();
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const debounced = useDebounced(query, 180);
  const search = useQuery<{ query: string; groups: { type: string; label: string; items: { id: string; title: string; subtitle: string; href: string }[] }[] }>({
    queryKey: ["/api/search?q=" + encodeURIComponent(debounced)],
    enabled: open && debounced.trim().length >= 2,
    staleTime: 10_000,
  });

  const { data: active } = useQuery<{ id: string } | null>({ queryKey: ["/api/work-sessions/active"], enabled: open && user?.role === "intern" });
  const startWork = useMutation({ mutationFn: () => api("POST", "/api/work-sessions/start"), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/work-sessions/active"] }); qc.invalidateQueries({ queryKey: ["/api/me/overview"] }); toast({ title: "Work Mode started" }); }, onError: (e: Error) => toast({ title: "Couldn't start Work Mode", description: e.message, variant: "destructive" }) });

  const go = (href: string) => { setLocation(href); setOpen(false); };
  const run = (fn: () => void) => { fn(); setOpen(false); };

  const navItems = useMemo(() => NAV.filter((n) => user && n.roles.includes(user.role)), [user]);
  const recent = useMemo(() => (open && !query ? readRecent() : []), [open, query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-xl top-[12%] translate-y-0 data-[state=open]:slide-in-from-top-2 border-line-strong">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command shouldFilter={!search.data} loop label="Command palette" className="flex flex-col">
          <div className="flex items-center gap-2 px-3 hairline-b">
            <Search className="h-4 w-4 text-ink-3 shrink-0" />
            <Command.Input value={query} onValueChange={setQuery} placeholder={user?.role === "admin" ? "Search tasks, people, projects — or type a command…" : "Search your tasks, projects, messages…"} className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-4" />
            <Kbd>esc</Kbd>
          </div>
          <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto scroll-thin p-1.5">
            <Command.Empty className="px-3 py-8 text-center text-[13px] text-ink-3">
              {search.isFetching ? "Searching…" : debounced.length >= 2 ? "Nothing matches. Try a task title, a person's name, or a project." : "Type to search, or pick a command."}
            </Command.Empty>

            {search.data?.groups.map((g) => {
              const Icon = GROUP_ICON[g.type] ?? ListTodo;
              return (
                <Command.Group key={g.type} heading={g.label} className="[&_[cmdk-group-heading]]:t-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {g.items.map((it) => (
                    <Item key={it.id} onSelect={() => { pushRecent(debounced); go(it.href); }} icon={<Icon className="h-4 w-4" />} title={it.title} subtitle={it.subtitle} />
                  ))}
                </Command.Group>
              );
            })}

            {!search.data && (
              <>
                {recent.length > 0 && (
                  <Command.Group heading="Recent searches" className="[&_[cmdk-group-heading]]:t-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                    {recent.map((r) => <Item key={r} value={`recent ${r}`} onSelect={() => setQuery(r)} icon={<Search className="h-4 w-4" />} title={r} />)}
                  </Command.Group>
                )}
                <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:t-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {user?.role === "admin" && <Item value="new task create" onSelect={() => go("/tasks?new=1")} icon={<Plus className="h-4 w-4" />} title="New task" shortcut="N" />}
                  {user?.role === "admin" && <Item value="new project assign" onSelect={() => go("/projects?new=1")} icon={<FolderKanban className="h-4 w-4" />} title="Assign a project" />}
                  {user?.role === "admin" && <Item value="invite intern add" onSelect={() => go("/people?invite=1")} icon={<UserPlus className="h-4 w-4" />} title="Invite an intern" shortcut="I" />}
                  {user?.role === "intern" && !active && <Item value="start work mode shift" onSelect={() => run(() => startWork.mutate())} icon={<Play className="h-4 w-4 text-work" />} title="Start Work Mode" />}
                  {user?.role === "intern" && active && <Item value="end work mode shift" onSelect={() => go("/work?end=1")} icon={<Square className="h-4 w-4 text-danger" />} title="End Work Mode…" />}
                  {user?.role === "intern" && <Item value="propose project" onSelect={() => go("/projects?propose=1")} icon={<Plus className="h-4 w-4" />} title="Propose a project" />}
                  <Item value="ask pulse" onSelect={() => go("/pulse")} icon={<Sparkles className="h-4 w-4 text-pulse" />} title="Ask Pulse" shortcut="P" />
                  <Item value="download companion" onSelect={() => go("/download")} icon={<Download className="h-4 w-4" />} title="Get the Companion app" />
                </Command.Group>
                <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:t-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {navItems.map((n) => <Item key={n.href} value={`go ${n.label}`} onSelect={() => go(n.href)} icon={<n.icon className="h-4 w-4" />} title={n.label} />)}
                </Command.Group>
                <Command.Group heading="Appearance" className="[&_[cmdk-group-heading]]:t-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  <Item value="theme light" onSelect={() => run(() => setPreference("light"))} icon={<Sun className="h-4 w-4" />} title="Light theme" />
                  <Item value="theme dark" onSelect={() => run(() => setPreference("dark"))} icon={<Moon className="h-4 w-4" />} title="Dark theme" />
                  <Item value="theme system" onSelect={() => run(() => setPreference("system"))} icon={<Laptop className="h-4 w-4" />} title="Match system" />
                </Command.Group>
                <Command.Group heading="Account" className="[&_[cmdk-group-heading]]:t-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  <Item value="sign out log out" onSelect={() => run(() => signOut())} icon={<LogOut className="h-4 w-4" />} title="Sign out" />
                </Command.Group>
              </>
            )}
          </Command.List>
          <div className="flex items-center justify-between px-3 py-2 border-t border-line text-[11px] text-ink-4">
            <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate <Kbd className="ml-1">↵</Kbd> open</span>
            <span className="flex items-center gap-1"><Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd><Kbd>K</Kbd></span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Item({ onSelect, icon, title, subtitle, shortcut, value }: { onSelect: () => void; icon: React.ReactNode; title: string; subtitle?: string; shortcut?: string; value?: string }) {
  return (
    <Command.Item value={value ?? title} onSelect={onSelect} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-[13px] text-ink data-[selected=true]:bg-surface-2 aria-selected:bg-surface-2 [&_svg]:text-ink-3 data-[selected=true]:[&_svg]:text-ink">
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        {subtitle && <span className="block truncate text-xs text-ink-3">{subtitle}</span>}
      </span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </Command.Item>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}
