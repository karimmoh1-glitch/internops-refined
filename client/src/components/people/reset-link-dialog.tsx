import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Link2 } from "lucide-react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CopyButton, RelativeTime } from "@/components/kit";

interface ResetLinkResult { resetLink: string; expiresAt: string; email: string }

// The manager-issued recovery path. The link is shown exactly once, here,
// to the manager who asked for it; the server stores only its hash.
export function ResetLinkDialog({ open, onOpenChange, userId, name }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string; name: string }) {
  const [result, setResult] = useState<ResetLinkResult | null>(null);
  const create = useMutation({
    mutationFn: () => api<ResetLinkResult>("POST", `/api/users/${userId}/reset-link`),
    onSuccess: setResult,
  });
  const close = (o: boolean) => { onOpenChange(o); if (!o) { setResult(null); create.reset(); } };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Password reset link for {name}</DialogTitle>
          <DialogDescription>
            A one-hour link that lets {name} choose a new password. Send it to them over a channel you trust. Their current password keeps working until they use it.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="rounded-lg border border-ok/20 bg-ok-soft px-3.5 py-3">
            <p className="text-[13px] font-medium text-ink">Reset link for {result.email}</p>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-3" />
              <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">{result.resetLink}</code>
              <CopyButton value={result.resetLink} size="xs" label="Copy link" />
            </div>
            <p className="mt-2 text-xs text-ink-3">Expires <RelativeTime value={result.expiresAt} />. This link is only shown once.</p>
          </div>
        ) : create.isError ? (
          <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-[13px] text-danger">{(create.error as Error).message}</p>
        ) : null}

        <DialogFooter>
          {result ? (
            <Button variant="outline" onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending} aria-busy={create.isPending}>
                <KeyRound className="h-4 w-4" />{create.isPending ? "Creating…" : "Create reset link"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
