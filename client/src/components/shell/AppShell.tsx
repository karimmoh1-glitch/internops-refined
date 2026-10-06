import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Menu, X, LogOut, ChevronsUpDown, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import LogoMark, { Wordmark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import { Kbd, Avatar } from "@/components/kit";
import { NAV, NAV_GROUP_LABEL, isActive, type NavGroup } from "./nav";
import { NotificationCenter } from "./NotificationCenter";
import { CommandPalette, useCommandPalette, openCommandPalette } from "./CommandPalette";
import { WorkModeChip } from "./WorkModeChip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [location] = useLocation();
  const search = useSearch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const palette = useCommandPalette();
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  const { data: chatUnread } = useQuery<{ count: number }>({ queryKey: ["/api/channels/unread"], refetchInterval: 20_000 });
  const { data: overviewCounts } = useQuery<any>({ queryKey: ["/api/overview?tzOffsetMinutes=" + new Date().getTimezoneOffset()], enabled: user?.role === "admin", refetchInterval: 60_000, staleTime: 30_000 });

  useEffect(() => { setMobileOpen(false); }, [location]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); openCommandPalette(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return <>{children}</>;
  const items = NAV.filter((n) => n.roles.includes(user.role));
  const badge = (href: string): number | undefined => {
    if (href === "/messages") return chatUnread?.count || undefined;
    if (href === "/signals") return overviewCounts?.counts?.signals || undefined;
    return undefined;
  };

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Primary">
      {(["workspace", "intelligence", "organization", "system"] as NavGroup[]).map((group, gi) => {
        const groupItems = items.filter((i) => i.group === group);
        if (groupItems.length === 0) return null;
        const label = NAV_GROUP_LABEL[group];
        return (
          <div key={group} className={cn(gi > 0 && "mt-4")}>
            {label && <div className="px-2 pb-1.5 text-[11px] font-medium text-ink-4">{label}</div>}
            {groupItems.map((item) => {
              const active = isActive(item, location, search);
              const n = badge(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                  className={cn("group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors", active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-line" : "text-ink-2 hover:bg-surface/60 hover:text-ink border border-transparent")}>
                  <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={active ? 2.25 : 2} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {n !== undefined && <span className={cn("t-num rounded-full px-1.5 min-w-[18px] h-[18px] text-[10.5px] font-semibold flex items-center justify-center", item.href === "/messages" ? "bg-accent text-accent-ink" : "bg-warn-soft text-warn")}>{n > 99 ? "99+" : n}</span>}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  const AccountMenu = ({ align = "end" }: { align?: "start" | "end" }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface/60 transition-colors" aria-label="Account menu">
          <Avatar name={user.name} size="md" />
          <span className="min-w-0 flex-1 hidden md:block">
            <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
            <span className="block truncate text-[11px] text-ink-3">{user.role === "admin" ? "Manager" : "Intern"}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-ink-4 hidden md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="font-normal"><span className="block text-[13px] font-medium">{user.name}</span><span className="block text-xs text-ink-3 truncate">{user.email}</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/settings">Settings</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/settings?section=appearance">Appearance</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/download">Companion app</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()} className="text-danger focus:text-danger"><LogOut className="h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-dvh bg-bg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-[232px] flex-col border-r border-line bg-bg-sunken/60" data-print-hide>
        <div className="flex h-14 items-center gap-2 px-4">
          <Link href="/" className="flex items-center gap-2"><LogoMark size={26} /><Wordmark /></Link>
        </div>
        <div className="px-3 pb-3">
          <button onClick={openCommandPalette} className="flex h-8 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink-3 hover:border-line-strong hover:text-ink-2 transition-colors" aria-label="Search and commands">
            <Search className="h-3.5 w-3.5" /><span className="flex-1 text-left">Search</span><Kbd>{isMac ? "⌘" : "Ctrl"}K</Kbd>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin pb-4"><NavList /></div>
        <div className="border-t border-line p-2">
          {user.role === "intern" && <div className="px-1 pb-2"><WorkModeChip className="w-full justify-center" /></div>}
          <AccountMenu align="start" />
        </div>
      </aside>

      {/* Main column */}
      <div className="md:pl-[232px] flex min-h-dvh flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/85 backdrop-blur px-4 sm:px-6 lg:px-8" data-print-hide>
          <div className="flex items-center gap-2 md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button>
            <Link href="/" className="flex items-center gap-2"><LogoMark size={24} /><Wordmark size={14} /></Link>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1.5">
            <WorkModeChip className="md:hidden" compact />
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search" onClick={openCommandPalette}><Search className="h-[18px] w-[18px]" /></Button>
            <NotificationCenter />
            <div className="md:hidden"><AccountMenu /></div>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <div key={location} className="anim-fade">{children}</div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Primary" data-print-hide>
        <div className="grid grid-cols-5">
          {items.filter((i) => ["/", "/tasks", "/work", "/pulse"].includes(i.href)).map((item) => {
            const active = isActive(item, location, search);
            return (
              <Link key={item.href} href={item.href} className={cn("flex flex-col items-center justify-center gap-1 h-14 text-[10.5px] font-medium", active ? "text-accent" : "text-ink-3")} aria-current={active ? "page" : undefined}>
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />{item.label}
              </Link>
            );
          })}
          <button onClick={() => setMobileOpen(true)} className={cn("flex flex-col items-center justify-center gap-1 h-14 text-[10.5px] font-medium text-ink-3")} aria-label="More">
            <MoreHorizontal className="h-5 w-5" />More
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-bg border-r border-line flex flex-col anim-fade">
            <div className="flex h-14 items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2"><LogoMark size={24} /><Wordmark size={14} /></Link>
              <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto py-2"><NavList onNavigate={() => setMobileOpen(false)} /></div>
            <div className="border-t border-line p-3 space-y-2">
              <div className="flex items-center gap-2.5 px-1"><Avatar name={user.name} size="md" /><div className="min-w-0"><p className="truncate text-[13px] font-medium">{user.name}</p><p className="truncate text-[11px] text-ink-3">{user.email}</p></div></div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => signOut()}><LogOut className="h-4 w-4" />Sign out</Button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={palette.open} setOpen={palette.setOpen} />
    </div>
  );
}
