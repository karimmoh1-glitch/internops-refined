import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, CheckCheck, Inbox, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { dayLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState, SkeletonRows, RelativeTime, ConfirmDialog } from "@/components/kit";

interface Notif { id: string; title: string; message: string; read: boolean; link: string | null; createdAt: string }

const KIND: { test: RegExp; tone: string }[] = [
  { test: /submitted|review/i, tone: "bg-info" },
  { test: /approved/i, tone: "bg-ok" },
  { test: /blocked|changes requested|overdue/i, tone: "bg-danger" },
  { test: /assigned|reassigned/i, tone: "bg-accent" },
  { test: /shift|work mode/i, tone: "bg-work" },
  { test: /comment|message/i, tone: "bg-pulse" },
];
function kindTone(title: string): string { return KIND.find((k) => k.test.test(title))?.tone ?? "bg-ink-4"; }

export function NotificationCenter({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data: unread } = useQuery<{ count: number }>({ queryKey: ["/api/notifications/unread-count"], refetchInterval: 30_000 });
  const list = useQuery<Notif[]>({ queryKey: ["/api/notifications"], enabled: open });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["/api/notifications"] }); qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] }); };
  const markRead = useMutation({ mutationFn: (id: string) => api("PUT", `/api/notifications/${id}/read`), onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: () => api("PUT", "/api/notifications/read-all"), onSuccess: invalidate });
  const clearAll = useMutation({ mutationFn: () => api("DELETE", "/api/notifications"), onSuccess: () => { invalidate(); setConfirmClear(false); } });

  const groups = useMemo(() => {
    const items = list.data ?? [];
    const needsAction = items.filter((n) => !n.read && /submitted|review|blocked|proposal|application|signup/i.test(n.title));
    const rest = items.filter((n) => !needsAction.includes(n));
    const byDay = new Map<string, Notif[]>();
    for (const n of rest) {
      const k = dayLabel(n.createdAt);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(n);
    }
    return { needsAction, byDay: Array.from(byDay.entries()) };
  }, [list.data]);

  const count = unread?.count ?? 0;
  const openItem = (n: Notif) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) { setLocation(n.link); setOpen(false); }
  };

  const Row = ({ n }: { n: Notif }) => (
    <button onClick={() => openItem(n)} className={cn("flex w-full items-start gap-3 px-3 py-2.5 text-left row-hover", !n.read && "bg-accent-soft/40")}>
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent border border-line-strong" : kindTone(n.title))} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink leading-snug">{n.title}</span>
        <span className="block text-xs text-ink-3 leading-snug line-clamp-2 mt-0.5">{n.message}</span>
      </span>
      <RelativeTime value={n.createdAt} className="text-[11px] text-ink-4 mt-0.5" />
    </button>
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={cn("relative", className)} aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}>
            <Bell className="h-[18px] w-[18px]" />
            {count > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-accent text-accent-ink text-[10px] font-semibold flex items-center justify-center t-num" aria-hidden>{count > 99 ? "99+" : count}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-[380px] max-w-[calc(100vw-16px)] p-0 overflow-hidden rounded-xl pop">
          <div className="flex items-center justify-between px-3 py-2.5 hairline-b">
            <span className="t-section">Notifications</span>
            <div className="flex items-center gap-1">
              {count > 0 && <Button variant="ghost" size="xs" onClick={() => markAll.mutate()} disabled={markAll.isPending}><CheckCheck className="h-3.5 w-3.5" />Mark all read</Button>}
              {(list.data?.length ?? 0) > 0 && <Button variant="ghost" size="icon-xs" aria-label="Clear all notifications" onClick={() => setConfirmClear(true)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto scroll-thin">
            {list.isLoading ? <div className="p-4"><SkeletonRows rows={5} /></div>
              : list.error ? <EmptyState compact icon={<Inbox />} title="Couldn't load notifications" description="Check your connection and try again." />
              : (list.data?.length ?? 0) === 0 ? <EmptyState compact icon={<Inbox />} title="You're all caught up" description="Task assignments, submissions, approvals, and shift events will show up here." />
              : (
                <div className="pb-1">
                  {groups.needsAction.length > 0 && (
                    <div>
                      <div className="px-3 pt-2.5 pb-1 t-label text-accent">Needs your attention · {groups.needsAction.length}</div>
                      {groups.needsAction.map((n) => <Row key={n.id} n={n} />)}
                    </div>
                  )}
                  {groups.byDay.map(([day, items]) => (
                    <div key={day}>
                      <div className="px-3 pt-2.5 pb-1 t-label">{day}</div>
                      {items.map((n) => <Row key={n.id} n={n} />)}
                    </div>
                  ))}
                </div>
              )}
          </div>
        </PopoverContent>
      </Popover>
      <ConfirmDialog open={confirmClear} onOpenChange={setConfirmClear} title="Clear all notifications?" description="This removes every notification permanently. Unread items will be gone too." confirmLabel="Clear all" destructive pending={clearAll.isPending} onConfirm={() => clearAll.mutate()} />
    </>
  );
}
