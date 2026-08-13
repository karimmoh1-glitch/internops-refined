import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  LogOut, Bell, CheckCheck, X, Command, MessageSquare, ListTodo, LayoutGrid,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import LogoMark from "@/components/logo-mark";

interface AppShellProps {
  user: { id: string; name: string; role: string };
  onSignOut: () => void;
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutGrid, testid: "link-dashboard" },
  { href: "/tasks", label: "Tasks", icon: ListTodo, testid: "link-tasks" },
  { href: "/chat", label: "Messages", icon: MessageSquare, testid: "link-chat" },
];

export default function AppShell({ user, onSignOut, children }: AppShellProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });
  const { data: chatUnread } = useQuery<{ count: number }>({
    queryKey: ["/api/channels/unread"],
    refetchInterval: 10000,
  });
  const { data: notifsList = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    enabled: showNotifs,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });
  const markAllReadMutation = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;
  const chatUnreadCount = chatUnread?.count || 0;
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const initial = user.name?.[0]?.toUpperCase() || "?";

  const openCommandPalette = () => window.dispatchEvent(new CustomEvent("open-command-palette"));

  const NavLinks = () => (
    <nav className="px-3 space-y-0.5" data-testid="sidebar-nav">
      {NAV_ITEMS.map((item) => {
        const active = location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileNavOpen(false)}
            className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
              active ? "bg-[#6D5EF5]/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
            data-testid={item.testid}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
            {item.href === "/chat" && chatUnreadCount > 0 && (
              <span className={`ml-auto text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ${active ? "bg-[#6D5EF5]/30 text-white" : "bg-[#6D5EF5] text-white"}`}>
                {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex bg-[#141110]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-white/[0.08] bg-[#0F0D0C] h-screen sticky top-0" data-testid="sidebar">
        <Link href="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.08] no-underline shrink-0" data-testid="link-home">
          <LogoMark size={30} rounded="md" />
          <div className="min-w-0">
            <p className="font-heading font-semibold text-[15px] text-white leading-tight">InternOps</p>
            <p className="text-[11px] text-white/40 leading-tight truncate">EDAI Workspace</p>
          </div>
        </Link>

        <div className="px-3 pt-4">
          <button
            onClick={openCommandPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-[#141110] text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-all mb-4"
            data-testid="button-command-palette"
          >
            <Command className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="px-1 py-0.5 text-[10px] bg-white/10 rounded border border-white/[0.08] font-mono">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>
        </div>

        <NavLinks />

        <div className="mt-auto p-3 border-t border-white/[0.08]">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline mb-1"
            data-testid="text-user-info"
          >
            <div className="w-8 h-8 rounded-full bg-[#6D5EF5]/15 text-[#6D5EF5] font-semibold text-xs flex items-center justify-center shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate" data-testid="text-user-name">{user.name}</p>
              <p className="text-[11px] text-white/50 capitalize" data-testid="text-user-role">{user.role === "admin" ? "Admin" : "Intern"}</p>
            </div>
          </Link>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            data-testid="button-signout"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile slide-out nav overlay */}
      {mobileNavOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileNavOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#0F0D0C] border-r border-white/[0.08] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <LogoMark size={26} rounded="md" />
                <span className="font-heading font-semibold text-sm text-white">InternOps</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="p-1 rounded-lg hover:bg-[#141110]/15">
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>
            <div className="pt-3">
              <NavLinks />
            </div>
            <div className="mt-auto p-3 border-t border-white/[0.08]">
              <Link href="/settings" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/10 no-underline mb-1">
                <div className="w-8 h-8 rounded-full bg-[#6D5EF5]/15 text-[#6D5EF5] font-semibold text-xs flex items-center justify-center shrink-0">{initial}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-[11px] text-white/50 capitalize">{user.role === "admin" ? "Admin" : "Intern"}</p>
                </div>
              </Link>
              <button onClick={onSignOut} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/80 hover:bg-white/10">
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden sticky top-0 z-30 h-14 bg-[#141110] border-b border-white/[0.08] flex items-center justify-between px-4 shrink-0">
          <button onClick={() => setMobileNavOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-white/10" data-testid="button-open-mobile-nav">
            <LayoutGrid className="w-5 h-5 text-white/60" />
          </button>
          <Link href="/" className="flex items-center gap-2 no-underline">
            <LogoMark size={24} rounded="md" />
            <span className="font-heading font-semibold text-sm text-white">InternOps</span>
          </Link>
          <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-lg hover:bg-white/10" data-testid="button-notifications-mobile">
            <Bell className="w-5 h-5 text-white/60" />
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[#6D5EF5] rounded-full" />}
          </button>
        </div>
        <div className="hidden md:flex h-14 border-b border-white/[0.08] items-center justify-end px-6 gap-2 shrink-0">
          <Link href="/chat" className="relative p-2 rounded-lg hover:bg-white/10 transition-colors no-underline" data-testid="link-chat-topbar">
            <MessageSquare className="w-[18px] h-[18px] text-white/50" />
            {chatUnreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#6D5EF5] rounded-full" />
            )}
          </Link>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
            data-testid="button-notifications"
          >
            <Bell className="w-[18px] h-[18px] text-white/50" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5 bg-[#6D5EF5] text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="badge-notification-count">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
        {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <div className="fixed top-14 right-4 md:right-6 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[#141110] rounded-xl border border-white/[0.08] shadow-xl z-50 overflow-hidden animate-scale-in" data-testid="panel-notifications">
                  <div className="p-3 border-b border-white/[0.06] flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Notifications</h3>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllReadMutation.mutate()}
                          className="text-xs text-[#6D5EF5] hover:text-[#5142D6] px-2 py-1 rounded hover:bg-red-500/100/10 flex items-center gap-1"
                          data-testid="button-mark-all-read"
                        >
                          <CheckCheck className="w-3 h-3" />
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setShowNotifs(false)} className="p-1 hover:bg-white/10 rounded">
                        <X className="w-4 h-4 text-white/40" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifsList.length === 0 ? (
                      <div className="p-6 text-center text-sm text-white/40">No notifications yet</div>
                    ) : (
                      notifsList.slice(0, 20).map((notif: any) => (
                        <div
                          key={notif.id}
                          className={`p-3 border-b border-white/[0.05] hover:bg-[#141110]/[0.06] transition-colors cursor-pointer ${!notif.read ? "bg-red-500/10" : ""}`}
                          onClick={() => {
                            if (!notif.read) markReadMutation.mutate(notif.id);
                            if (notif.link) {
                              setLocation(notif.link);
                              setShowNotifs(false);
                            }
                          }}
                          data-testid={`notification-${notif.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notif.read ? "bg-[#6D5EF5]" : "bg-transparent"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white/90">{notif.title}</p>
                              <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{notif.message}</p>
                              <p className="text-[10px] text-white/40 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
        )}
        <main className="flex-1 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
