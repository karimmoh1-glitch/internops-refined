import { useState, useEffect } from "react";
import { Command } from "cmdk";
import {
  UserPlus, Briefcase, BarChart3, Bell,
  LogOut, Search, FileText, Home
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  group: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
}

export default function CommandPalette({ open, onOpenChange, items }: CommandPaletteProps) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  if (!open) return null;

  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[100] animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[20vh]">
        <Command
          className="w-full max-w-lg bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden animate-fade-in-up"
          shouldFilter={true}
          data-testid="command-palette"
        >
          <div className="flex items-center border-b border-gray-200 px-4">
            <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="w-full py-3 text-sm text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
              data-testid="command-palette-input"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 rounded border border-gray-200 font-mono">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-gray-400">
              No results found.
            </Command.Empty>

            {groups.map((group) => {
              const groupItems = items.filter((i) => i.group === group);
              return (
                <Command.Group key={group} heading={group} className="mb-1">
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {group}
                  </div>
                  {groupItems.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={[item.label, ...(item.keywords || [])].join(" ")}
                      onSelect={() => {
                        item.action();
                        onOpenChange(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-gray-100 data-[selected]:bg-blue-50 data-[selected]:text-blue-700 transition-colors"
                      data-testid={`command-item-${item.id}`}
                    >
                      <item.icon className="w-4 h-4 shrink-0 opacity-60" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-gray-400 ml-2">{item.description}</span>
                        )}
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </>
  );
}

export function useAdminCommands({
  onInvite,
  onAssign,
  onReview,
  onSignOut,
  onNavigateHome,
}: {
  onInvite: () => void;
  onAssign: () => void;
  onReview: () => void;
  onSignOut: () => void;
  onNavigateHome: () => void;
}): CommandItem[] {
  return [
    { id: "invite", label: "Invite Intern", description: "Send invitation link", icon: UserPlus, action: onInvite, group: "Actions", keywords: ["add", "new", "intern"] },
    { id: "assign", label: "Assign Project", description: "Create new project assignment", icon: Briefcase, action: onAssign, group: "Actions", keywords: ["create", "project", "new"] },
    { id: "review", label: "Review Plans", description: "View plans pending review", icon: FileText, action: onReview, group: "Actions", keywords: ["approve", "revision", "submitted"] },
    { id: "home", label: "Go to Dashboard", icon: Home, action: onNavigateHome, group: "Navigation", keywords: ["dashboard", "main"] },
    { id: "signout", label: "Sign Out", icon: LogOut, action: onSignOut, group: "Account", keywords: ["logout", "exit"] },
  ];
}

export function useInternCommands({
  projects,
  onSelectProject,
  onSignOut,
  onNavigateHome,
}: {
  projects: any[];
  onSelectProject: (id: string) => void;
  onSignOut: () => void;
  onNavigateHome: () => void;
}): CommandItem[] {
  const projectItems: CommandItem[] = projects.map((p) => ({
    id: `project-${p.id}`,
    label: p.title || p.idea || "Untitled",
    description: p.status,
    icon: FileText,
    action: () => onSelectProject(p.id),
    group: "Projects",
    keywords: [p.idea, p.status].filter(Boolean),
  }));

  return [
    ...projectItems,
    { id: "home", label: "My Projects", icon: Home, action: onNavigateHome, group: "Navigation", keywords: ["dashboard", "list", "back"] },
    { id: "signout", label: "Sign Out", icon: LogOut, action: onSignOut, group: "Account", keywords: ["logout", "exit"] },
  ];
}
