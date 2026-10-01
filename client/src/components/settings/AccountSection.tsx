import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ErrorState } from "@/components/kit";
import { Group, Row, RowsSkeleton, SectionHeader, Value } from "./primitives";
import { DEVICES_KEY, useDevices } from "./devices";

export function AccountSection() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const devices = useDevices();
  const others = devices.active.filter((d) => !d.isCurrent);

  const [confirmOthers, setConfirmOthers] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  // There's no bulk endpoint; revoke each other device in turn and report
  // honestly if some failed.
  const signOutOthers = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(others.map((d) => api("DELETE", `/api/devices/${d.id}`)));
      const failed = results.filter((r) => r.status === "rejected");
      return { done: results.length - failed.length, failed: failed.length, firstError: failed[0] && failed[0].status === "rejected" ? (failed[0].reason as Error)?.message : null };
    },
    onSuccess: ({ done, failed, firstError }) => {
      qc.invalidateQueries({ queryKey: DEVICES_KEY });
      setConfirmOthers(false);
      if (failed === 0) toast({ title: done === 0 ? "No other devices were signed in" : `Signed out ${done} ${done === 1 ? "device" : "devices"}` });
      else toast({ title: `Signed out ${done}, ${failed} failed`, description: firstError ?? undefined, variant: "destructive" });
    },
    onError: (err: Error) => toast({ title: "Couldn't sign out other devices", description: err.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <div className="space-y-5">
      <SectionHeader title="Account" description="Sessions for this account. Signing out never deletes anything." />

      <Group>
        <Row label="Signed in as" control={<Value>{user.email}</Value>} />
      </Group>

      <Group title="Sessions">
        {devices.isLoading ? (
          <RowsSkeleton rows={1} />
        ) : devices.error ? (
          <ErrorState compact message={(devices.error as Error).message} onRetry={() => devices.refetch()} />
        ) : (
          <Row
            label="Sign out everywhere else"
            description={others.length === 0 ? "No other devices are signed in right now." : `${others.length} other ${others.length === 1 ? "device is" : "devices are"} signed in. This one stays signed in.`}
            control={<Button variant="outline" size="sm" disabled={others.length === 0 || signOutOthers.isPending} onClick={() => setConfirmOthers(true)}><ShieldOff className="h-3.5 w-3.5" />Sign out others</Button>}
          />
        )}
        <Row
          label="Sign out"
          description="Ends this session on this device. Your other devices aren't affected."
          control={<Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setConfirmOut(true)}><LogOut className="h-3.5 w-3.5" />Sign out</Button>}
        />
      </Group>

      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title="Sign out all other devices?"
        description={`${others.length} ${others.length === 1 ? "device loses" : "devices lose"} access immediately, including any Companion. You stay signed in here.`}
        confirmLabel="Sign out others"
        destructive
        pending={signOutOthers.isPending}
        onConfirm={() => signOutOthers.mutate()}
      />
      <ConfirmDialog
        open={confirmOut}
        onOpenChange={setConfirmOut}
        title="Sign out of InternOps?"
        description="You'll be back at the sign-in page. Nothing is deleted."
        confirmLabel="Sign out"
        onConfirm={() => signOut()}
      />
    </div>
  );
}
