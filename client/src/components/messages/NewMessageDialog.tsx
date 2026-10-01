import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, EmptyState, ErrorState, SkeletonRows } from "@/components/kit";
import { type CompanyUser, roleLabel } from "./types";

// Picks a person to message. The actual POST /api/channels/dm lives in the
// page so the same mutation also serves the ?userId= deep link.
export function NewMessageDialog({ open, onOpenChange, currentUserId, onPick, pending }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUserId: string;
  onPick: (userId: string) => void;
  pending: boolean;
}) {
  const [q, setQ] = useState("");
  const users = useQuery<CompanyUser[]>({ queryKey: ["/api/company/users"], enabled: open });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users.data ?? [])
      .filter((u) => u.id !== currentUserId && u.role !== "system")
      .filter((u) => !term || u.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users.data, q, currentUserId]);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(""); }}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-[15px]">New message</DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-3">Start or reopen a direct message with someone in your workspace.</DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="h-8 pl-8 md:text-[13px]" autoFocus aria-label="Search people" />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto scroll-thin border-t border-line" role="listbox" aria-label="People">
          {users.isLoading ? (
            <div className="p-4"><SkeletonRows rows={4} /></div>
          ) : users.error ? (
            <ErrorState compact message={(users.error as Error).message} onRetry={() => users.refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState compact title={q ? "No one matches" : "No one else here yet"} description={q ? "Try a different name." : "Invite people from the People page to start a conversation."} />
          ) : (
            <ul className="py-1">
              {filtered.map((u) => (
                <li key={u.id}>
                  <button type="button" role="option" aria-selected={false} disabled={pending} onClick={() => onPick(u.id)}
                    className={cn("flex w-full items-center gap-3 px-5 py-2 text-left row-hover disabled:opacity-60")}>
                    <Avatar name={u.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{u.name}</span>
                      <span className="block text-[11.5px] text-ink-3">{roleLabel(u.role)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
