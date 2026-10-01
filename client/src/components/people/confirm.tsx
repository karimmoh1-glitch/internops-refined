import { type ReactNode, useState } from "react";
import { ConfirmDialog } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// One pending confirmation at a time per screen. The caller stores a
// `PendingAction` (or null) in state; this component renders the kit
// ConfirmDialog, runs the action, shows the pending state, and closes on
// success. Errors are left to the mutation's own toast and keep the dialog
// open so the person can retry or cancel.
export interface PendingAction {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  run: () => Promise<unknown>;
}

export function ActionConfirm({ action, onClose }: { action: PendingAction | null; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <ConfirmDialog
      open={!!action}
      onOpenChange={(o) => { if (!o && !pending) onClose(); }}
      title={action?.title ?? ""}
      description={action?.description}
      confirmLabel={action?.confirmLabel ?? "Confirm"}
      destructive={action?.destructive}
      pending={pending}
      onConfirm={async () => {
        if (!action) return;
        setPending(true);
        try { await action.run(); onClose(); }
        catch { /* surfaced by the mutation's toast */ }
        finally { setPending(false); }
      }}
    />
  );
}

// Permanent deletion asks the person to type the name back. Same chrome as
// ConfirmDialog, plus the typed gate — nothing irreversible on one click.
export function TypedDeleteDialog({ open, onOpenChange, name, title, description, confirmLabel = "Delete permanently", onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; name: string; title: string; description: ReactNode; confirmLabel?: string; onConfirm: () => Promise<unknown>;
}) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const matches = typed.trim() === name.trim();
  const close = (o: boolean) => { if (!o && pending) return; if (!o) setTyped(""); onOpenChange(o); };
  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="typed-delete-name" className="text-[13px] text-ink-2">Type <span className="font-semibold text-ink">{name}</span> to confirm</Label>
          <Input id="typed-delete-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" disabled={!matches || pending} onClick={async (e) => {
              e.preventDefault();
              setPending(true);
              try { await onConfirm(); setTyped(""); onOpenChange(false); }
              catch { /* surfaced by the mutation's toast */ }
              finally { setPending(false); }
            }}>{pending ? "Deleting…" : confirmLabel}</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
