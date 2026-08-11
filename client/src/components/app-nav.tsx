import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { LogOut, Bell, CheckCheck, X, Command, MessageSquare } from "lucide-react";
import { Link, useLocation } from "wouter";

interface AppNavProps {
  user: { id: string; name: string; role: string };
  onSignOut: () => void;
  onOpenCommandPalette?: () => void;
}

export default function AppNav({ user, onSignOut, onOpenCommandPalette }: AppNavProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

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
    mutationFn: async (id: string) => {
      return apiRequest("PUT", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;
  const chatUnreadCount = chatUnread?.count || 0;
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-heading font-bold text-lg text-slate-900 no-underline hover:opacity-80 transition-opacity" data-testid="link-home">
          <div className="w-7 h-7 bg-[#EF7878] rounded flex items-center justify-center text-white font-bold text-sm">
            I
          </div>
          InternOps
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (onOpenCommandPalette) {
                onOpenCommandPalette();
              } else {
                window.dispatchEvent(new CustomEvent("open-command-palette"));
              }
            }}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
            data-testid="button-command-palette"
          >
            <Command className="w-3 h-3" />
            <span>Search...</span>
            <kbd className="ml-1 px-1 py-0.5 text-[10px] bg-gray-100 rounded border border-gray-200 font-mono">
              {isMac ? "\u2318K" : "Ctrl+K"}
            </kbd>
          </button>

          <Link href="/chat" className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors no-underline" data-testid="link-chat">
            <MessageSquare className="w-5 h-5 text-slate-500" />
            {chatUnreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
              </span>
            )}
          </Link>

          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
              data-testid="button-notifications"
            >
              <Bell className="w-5 h-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="badge-notification-count">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-scale-in" data-testid="panel-notifications">
                  <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllReadMutation.mutate()}
                          className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1"
                          data-testid="button-mark-all-read"
                        >
                          <CheckCheck className="w-3 h-3" />
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setShowNotifs(false)} className="p-1 hover:bg-slate-100 rounded">
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifsList.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">
                        No notifications yet
                      </div>
                    ) : (
                      notifsList.slice(0, 20).map((notif: any) => (
                        <div
                          key={notif.id}
                          className={`p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!notif.read ? "bg-blue-50/50" : ""}`}
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
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notif.read ? "bg-blue-500" : "bg-transparent"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800">{notif.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 px-2 py-1.5 transition-all duration-200" data-testid="text-user-info">
            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-xs transition-all duration-200">
              {user.name[0]?.toUpperCase() || "?"}
            </div>
            <span className="text-sm text-slate-600 hidden sm:inline" data-testid="text-user-name">
              {user.name}
            </span>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize hidden sm:inline" data-testid="text-user-role">
              {user.role === "admin" ? "Manager" : user.role}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="text-slate-400 hover:text-slate-600"
            data-testid="button-signout"
          >
            <LogOut className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline text-xs">Sign Out</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
