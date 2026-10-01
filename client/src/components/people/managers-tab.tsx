import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserMinus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, ErrorState, Pill, Section, SkeletonRows } from "@/components/kit";
import { ActionConfirm, type PendingAction } from "./confirm";
import { type Manager, invalidatePeople } from "./types";

export function ManagersTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const managers = useQuery<Manager[]>({ queryKey: ["/api/managers"] });

  // The server refuses to demote yourself or the last manager; its message
  // is the one shown.
  const demote = useMutation({
    mutationFn: (m: Manager) => api<Manager>("POST", `/api/managers/${m.id}/demote`),
    onSuccess: (d) => { invalidatePeople(qc); toast({ title: "Moved to intern", description: `${d.name} no longer has manager access.` }); },
    onError: (err: Error) => toast({ title: "Couldn't demote", description: err.message, variant: "destructive" }),
  });

  const list = managers.data ?? [];
  const lastOne = list.length <= 1;

  return (
    <Section title="Managers" description="Managers see every intern, task, project, and setting in this workspace." flush>
      {managers.isLoading ? <div className="p-4"><SkeletonRows rows={3} /></div> :
        managers.error ? <ErrorState compact message={(managers.error as Error).message} onRetry={() => void managers.refetch()} /> :
        list.length === 0 ? <EmptyState compact icon={<ShieldCheck />} title="No managers found" description="Promote an intern from the Interns tab to give them manager access." /> : (
          <ul className="divide-y divide-line">
            {list.map((m) => {
              const isSelf = m.id === user?.id;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <Avatar name={m.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium text-ink">{m.name}</span>
                      {isSelf && <Pill tone="accent">You</Pill>}
                    </div>
                    <p className="truncate text-xs text-ink-3">{m.email}{m.createdAt && <> · manager since {formatDate(m.createdAt, { month: "short", year: "numeric" })}</>}</p>
                  </div>
                  {!isSelf && (
                    <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" disabled={lastOne || demote.isPending}
                      title={lastOne ? "The last manager can't be demoted" : undefined}
                      onClick={() => setConfirm({
                        title: `Move ${m.name} back to intern?`,
                        description: "They lose manager access immediately and see the intern workspace on their next page load.",
                        confirmLabel: "Demote to intern", destructive: true,
                        run: () => demote.mutateAsync(m),
                      })}>
                      <UserMinus className="h-3.5 w-3.5" />Demote
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      <ActionConfirm action={confirm} onClose={() => setConfirm(null)} />
    </Section>
  );
}
