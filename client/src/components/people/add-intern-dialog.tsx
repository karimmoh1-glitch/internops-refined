import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton, KeyValue } from "@/components/kit";
import { invalidatePeople } from "./types";

interface Created { id: string; name: string; email: string }

// "Add intern (set password)": the account exists immediately with a
// password the admin chooses and relays. No email, no link.
export function AddInternDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<(Created & { password: string }) | null>(null);

  const create = useMutation({
    mutationFn: () => api<Created>("POST", "/api/interns", { name: name.trim(), email: email.trim(), password }),
    onSuccess: (d) => { setCreated({ ...d, password }); invalidatePeople(qc); toast({ title: "Account created", description: `${d.name} can sign in right now.` }); },
    onError: (err: Error) => toast({ title: "Couldn't create account", description: err.message, variant: "destructive" }),
  });

  const reset = () => { setCreated(null); setName(""); setEmail(""); setPassword(""); };
  const close = (o: boolean) => { onOpenChange(o); if (!o) reset(); };
  const valid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 6;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add intern (set password)</DialogTitle>
          <DialogDescription>Creates the account immediately. You choose the password and pass it on yourself; they can change it later in Settings.</DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-ok/20 bg-ok-soft px-3.5 py-3">
              <p className="text-[13px] font-medium text-ink">{created.name} can sign in now</p>
              <KeyValue className="mt-2" items={[
                { label: "Email", value: <span className="font-mono text-[12.5px]">{created.email}</span> },
                { label: "Password", value: <span className="font-mono text-[12.5px]">{created.password}</span> },
              ]} />
              <p className="mt-2 text-xs text-ink-3">The password is only shown here. Copy it before closing.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={`Email: ${created.email}\nPassword: ${created.password}`} label="Copy credentials" size="sm" className="border border-line-strong" />
              <Button variant="ghost" size="sm" onClick={reset}>Add another</Button>
            </div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid && !create.isPending) create.mutate(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="add-name" className="text-[13px] text-ink-2">Name</Label>
              <Input id="add-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="off" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email" className="text-[13px] text-ink-2">Email</Label>
              <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-password" className="text-[13px] text-ink-2">Temporary password</Label>
              <Input id="add-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" spellCheck={false} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>Cancel</Button>
              <Button type="submit" disabled={!valid || create.isPending}><UserPlus className="h-4 w-4" />{create.isPending ? "Creating…" : "Create account"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
