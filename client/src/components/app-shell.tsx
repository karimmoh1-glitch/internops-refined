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
              active ? "bg-[#14171F] text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            data-testid={item.testid}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
            {item.href === "/chat" && chatUnreadCount > 0 && (
              <span className={`ml-auto text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ${active ? "bg-white/20 text-white" : "bg-[#E8604F] text-white"}`}>
                {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex bg-white">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-gray-200 bg-[#FAFAFA] h-screen sticky top-0" data-testid="sidebar">
        <Link href="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-200 no-underline shrink-0" data-testid="link-home">
          <LogoMark size={30} rounded="md" />
          <div className="min-w-0">
            <p className="font-heading font-semibold text-[15px] text-gray-900 leading-tight">InternOps</p>
            <p className="text-[11px] text-gray-400 leading-tight truncate">EDAI Workspace</p>
          </div>
        </Link>

        <div className="px-3 pt-4">
          <button
            onClick={openCommandPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all mb-4"
            data-testid="button-command-palette"
          >
            <Command className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="px-1 py-0.5 text-[10px] bg-gray-100 rounded border border-gray-200 font-mono">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>
        </div>

        <NavLinks />

        <div className="mt-auto p-3 border-t border-gray-200">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors no-underline mb-1"
            data-testid="text-user-info"
          >
            <div className="w-8 h-8 rounded-full bg-[#E8604F]/15 text-[#E8604F] font-semibold text-xs flex items-center justify-center shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate" data-testid="text-user-name">{user.name}</p>
              <p className="text-[11px] text-gray-500 capitalize" data-testid="text-user-role">{user.role === "admin" ? "Manager" : "Intern"}</p>
            </div>
          </Link>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#FAFAFA] border-r border-gray-200 flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <LogoMark size={26} rounded="md" />
                <span className="font-heading font-semibold text-sm text-gray-900">InternOps</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="p-1 rounded-lg hover:bg-gray-200">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="pt-3">
              <NavLinks />
            </div>
            <div className="mt-auto p-3 border-t border-gray-200">
              <Link href="/settings" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-100 no-underline mb-1">
                <div className="w-8 h-8 rounded-full bg-[#E8604F]/15 text-[#E8604F] font-semibold text-xs flex items-center justify-center shrink-0">{initial}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-[11px] text-gray-500 capitalize">{user.role === "admin" ? "Manager" : "Intern"}</p>
                </div>
              </Link>
              <button onClick={onSignOut} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden sticky top-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <button onClick={() => setMobileNavOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100" data-testid="button-open-mobile-nav">
            <LayoutGrid className="w-5 h-5 text-gray-600" />
          </button>
          <Link href="/" className="flex items-center gap-2 no-underline">
            <LogoMark size={24} rounded="md" />
            <span className="font-heading font-semibold text-sm text-gray-900">InternOps</span>
          </Link>
          <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-lg hover:bg-gray-100" data-testid="button-notifications-mobile">
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[#E8604F] rounded-full" />}
          </button>
        </div>
        <div className="hidden md:flex h-14 border-b border-gray-200 items-center justify-end px-6 gap-2 shrink-0">
          <Link href="/chat" className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors no-underline" data-testid="link-chat-topbar">
            <MessageSquare className="w-[18px] h-[18px] text-gray-500" />
            {chatUnreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#E8604F] rounded-full" />
            )}
          </Link>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            data-testid="button-notifications"
          >
            <Bell className="w-[18px] h-[18px] text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5 bg-[#E8604F] text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="badge-notification-count">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
        {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <div className="fixed top-14 right-4 md:right-6 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden animate-scale-in" data-testid="panel-notifications">
                  <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllReadMutation.mutate()}
                          className="text-xs text-[#E8604F] hover:text-[#C94A3B] px-2 py-1 rounded hover:bg-red-50 flex items-center gap-1"
                          data-testid="button-mark-all-read"
                        >
                          <CheckCheck className="w-3 h-3" />
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setShowNotifs(false)} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifsList.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-400">No notifications yet</div>
                    ) : (
                      notifsList.slice(0, 20).map((notif: any) => (
                        <div
                          key={notif.id}
                          className={`p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? "bg-red-50/40" : ""}`}
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
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notif.read ? "bg-[#E8604F]" : "bg-transparent"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800">{notif.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                              <p className="text-[10px] text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
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
