import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Link2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton, EmptyState, ErrorState, Pill, RelativeTime, SectionLabel, SkeletonRows } from "@/components/kit";
import { useNow } from "@/lib/use-now";
import { type Invitation, invalidatePeople } from "./types";

interface InviteResult { inviteLink: string; invitation: { id: string; email: string; expiresAt: string } }

// Invite = the intern sets their own password through a 48h link. The link
// is shown once here (and emailed if mail is configured) — copy it.
export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);

  const invitations = useQuery<Invitation[]>({ queryKey: ["/api/invitations"], enabled: open });
  const now = useNow(60_000);
  const pending = (invitations.data ?? []).filter((i) => !i.used);

  const create = useMutation({
    mutationFn: () => api<InviteResult>("POST", "/api/invitations", { name: name.trim(), email: email.trim() }),
    onSuccess: (d) => { setResult(d); invalidatePeople(qc); toast({ title: "Invitation created", description: `Share the link with ${d.invitation.email}. It expires in 48 hours.` }); },
    onError: (err: Error) => toast({ title: "Couldn't create invitation", description: err.message, variant: "destructive" }),
  });

  const close = (o: boolean) => { onOpenChange(o); if (!o) { setResult(null); setName(""); setEmail(""); } };
  const valid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim());

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite an intern</DialogTitle>
          <DialogDescription>They open the link, set their own password, and land in your workspace. Links expire after 48 hours.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-ok/20 bg-ok-soft px-3.5 py-3">
              <p className="text-[13px] font-medium text-ink">Invite link for {result.invitation.email}</p>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">{result.inviteLink}</code>
                <CopyButton value={result.inviteLink} size="xs" label="Copy link" />
              </div>
              <p className="mt-2 text-xs text-ink-3">Expires <RelativeTime value={result.invitation.expiresAt} />. This link is only shown once.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setResult(null); setName(""); setEmail(""); }}>Invite another</Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid && !create.isPending) create.mutate(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name" className="text-[13px] text-ink-2">Name</Label>
              <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="off" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-[13px] text-ink-2">Email</Label>
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="off" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>Cancel</Button>
              <Button type="submit" disabled={!valid || create.isPending}><Mail className="h-4 w-4" />{create.isPending ? "Creating…" : "Create invite link"}</Button>
            </DialogFooter>
          </form>
        )}

        <div className="mt-2 border-t border-line pt-4">
          <SectionLabel right={pending.length > 0 ? <span className="t-num text-xs text-ink-3">{pending.length}</span> : undefined}>Pending invitations</SectionLabel>
          {invitations.isLoading ? <SkeletonRows rows={2} /> :
            invitations.error ? <ErrorState compact message={(invitations.error as Error).message} onRetry={() => void invitations.refetch()} /> :
            pending.length === 0 ? <EmptyState compact title="No pending invitations" description="Invites appear here until they are accepted or expire." /> : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {pending.map((inv) => {
                  const expired = new Date(inv.expiresAt).getTime() < now.getTime();
                  return (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                      <span className="min-w-0 truncate text-[13px] text-ink">{inv.email}</span>
                      {expired
                        ? <Pill tone="neutral">Expired</Pill>
                        : <span className="text-xs text-ink-3">Expires <RelativeTime value={inv.expiresAt} /></span>}
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
