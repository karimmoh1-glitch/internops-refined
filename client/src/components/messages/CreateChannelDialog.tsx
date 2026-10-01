import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Hash, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, ErrorState, SkeletonRows } from "@/components/kit";
import { type Channel, type CompanyUser, CHANNELS_KEY, roleLabel } from "./types";

// Admin-only. Mirrors the legacy dialog: slug-style name, pick members,
// POST /api/channels. The creator is added server-side automatically.
export function CreateChannelDialog({ open, onOpenChange, currentUserId, onCreated }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUserId: string;
  onCreated: (channel: Channel) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const users = useQuery<CompanyUser[]>({ queryKey: ["/api/company/users"], enabled: open });

  const reset = () => { setName(""); setSelected([]); setQ(""); };

  const create = useMutation({
    mutationFn: () => api<Channel>("POST", "/api/channels", { name: name.trim(), memberIds: selected }),
    onSuccess: (channel) => {
      qc.setQueryData<Channel[]>(CHANNELS_KEY, (old) => old && !old.some((c) => c.id === channel.id) ? [...old, { ...channel, unreadCount: 0 }] : old);
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
      toast({ title: `#${channel.name} created` });
      onOpenChange(false);
      reset();
      onCreated(channel);
    },
    onError: (err: Error) => toast({ title: "Couldn't create channel", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users.data ?? [])
      .filter((u) => u.id !== currentUserId && u.role !== "system")
      .filter((u) => !term || u.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users.data, q, currentUserId]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const canCreate = name.trim().length > 0 && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">New channel</DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-3">A focused space for a team or topic. Only the people you add can see it.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canCreate) create.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="channel-name" className="text-[12.5px] text-ink-2">Name</Label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
              <Input id="channel-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="frontend-team" maxLength={80} className="pl-8" autoFocus />
            </div>
            <p className="text-[11.5px] text-ink-4">Lowercase letters, numbers and dashes.</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="channel-members" className="text-[12.5px] text-ink-2">Members</Label>
              <span className="t-num text-[11px] text-ink-3">{selected.length} selected</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
              <Input id="channel-members" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="h-8 pl-8 md:text-[13px]" />
            </div>
            <div className="max-h-48 overflow-y-auto scroll-thin rounded-md border border-line bg-bg-sunken/50">
              {users.isLoading ? (
                <div className="p-3"><SkeletonRows rows={3} /></div>
              ) : users.error ? (
                <ErrorState compact message={(users.error as Error).message} onRetry={() => users.refetch()} />
              ) : filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12.5px] text-ink-3">{q ? "No one matches." : "No one else to add yet."}</p>
              ) : (
                <ul className="py-1">
                  {filtered.map((u) => {
                    const on = selected.includes(u.id);
                    return (
                      <li key={u.id}>
                        <button type="button" onClick={() => toggle(u.id)} aria-pressed={on}
                          className={cn("flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors", on ? "bg-accent-soft/60" : "hover:bg-surface-2")}>
                          <Avatar name={u.name} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{u.name}</span>
                          <span className="text-[11px] text-ink-3">{roleLabel(u.role)}</span>
                          <span className={cn("flex h-4 w-4 items-center justify-center rounded-sm border", on ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface")} aria-hidden>
                            {on && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!canCreate}>{create.isPending ? "Creating…" : "Create channel"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
