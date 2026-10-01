import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, ShieldAlert, ShieldPlus, UserMinus, UserPlus, UserCheck, CheckCircle2, XCircle, HelpCircle, FileText, Award, GraduationCap, ListTodo, Pencil, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, RelativeTime, SkeletonRows, type Tone, toneClasses } from "@/components/kit";
import { Field, Group, SectionHeader } from "./primitives";
import { DEVICES_KEY, DeviceRow, DevicesSkeleton, useDevices } from "./devices";

export function SecuritySection() {
  const { user } = useAuth();
  return (
    <div className="space-y-5">
      <SectionHeader title="Security" description="Your password, every device signed in to your account, and what has happened recently." />
      <ChangePassword />
      <Devices />
      {user?.role === "admin" && <ActivityLog />}
    </div>
  );
}

function ChangePassword() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => api<{ message: string }>("PUT", "/api/auth/change-password", { currentPassword: current, newPassword: next }),
    onSuccess: (data) => {
      setCurrent(""); setNext(""); setConfirm(""); setError(null);
      qc.invalidateQueries({ queryKey: DEVICES_KEY });
      toast({ title: data?.message ?? "Password updated", description: "Every other device was signed out. This one stays signed in." });
    },
    onError: (err: Error) => toast({ title: "Couldn't change password", description: err.message, variant: "destructive" }),
  });

  const submit = () => {
    if (!current || !next || !confirm) { setError("Fill in all three fields."); return; }
    if (next.length < 6) { setError("The new password needs at least 6 characters."); return; }
    if (next !== confirm) { setError("The new passwords don't match."); return; }
    setError(null);
    change.mutate();
  };

  return (
    <Group title="Password" description="Changing your password signs out every other device. The one you're using now stays signed in.">
      <form className="space-y-3 px-4 py-3.5" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <div className="grid gap-3 sm:max-w-sm">
          <Field label="Current password" htmlFor="current-password">
            <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" htmlFor="new-password" hint="At least 6 characters.">
            <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-password">
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!error || undefined} />
          </Field>
        </div>
        {error && <p className="text-[12.5px] text-danger" role="alert">{error}</p>}
        <div><Button type="submit" disabled={change.isPending}>{change.isPending ? "Updating…" : "Update password"}</Button></div>
      </form>
    </Group>
  );
}

function Devices() {
  const devices = useDevices();
  return (
    <Group title="Devices" description="Every browser and app currently signed in to your account. Signing one out takes effect on its next request." footer="A device is created each time you sign in. Renaming it only changes the label here.">
      {devices.isLoading ? (
        <DevicesSkeleton rows={2} />
      ) : devices.error ? (
        <ErrorState compact message={(devices.error as Error).message} onRetry={() => devices.refetch()} />
      ) : devices.active.length === 0 ? (
        <EmptyState compact icon={<ShieldAlert />} title="No devices on record" description="That's unexpected for a signed-in account. Try reloading." />
      ) : (
        devices.active
          .slice()
          .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
          .map((d) => <DeviceRow key={d.id} device={d} />)
      )}
    </Group>
  );
}

interface AuditLog { id: string; action: string; targetType: string | null; targetId: string | null; metadata: Record<string, unknown> | null; createdAt: string }

const AUDIT_META: Record<string, { label: string; icon: typeof History; tone: Tone }> = {
  "admin.bootstrapped": { label: "Became the first manager", icon: ShieldPlus, tone: "accent" },
  "admin.demoted_to_intern": { label: "Demoted a manager to intern", icon: UserMinus, tone: "warn" },
  "application.approved": { label: "Approved an application", icon: CheckCircle2, tone: "ok" },
  "application.info_requested": { label: "Asked an applicant for more information", icon: HelpCircle, tone: "info" },
  "application.rejected": { label: "Rejected an application", icon: XCircle, tone: "danger" },
  "created_new_version": { label: "Created a new plan version", icon: FileText, tone: "info" },
  "device.revoked": { label: "Signed out a device", icon: ShieldAlert, tone: "danger" },
  "intern.alumni_reactivated": { label: "Reactivated an alumni account", icon: UserCheck, tone: "ok" },
  "intern.alumni_transition": { label: "Moved an intern to alumni", icon: GraduationCap, tone: "neutral" },
  "intern.completion_badge_awarded": { label: "Awarded a completion badge", icon: Award, tone: "ok" },
  "intern.completion_badge_revoked": { label: "Revoked a completion badge", icon: XCircle, tone: "warn" },
  "intern.created": { label: "Added an intern", icon: UserPlus, tone: "ok" },
  "intern.deactivated": { label: "Deactivated an intern", icon: UserMinus, tone: "warn" },
  "intern.deleted_permanently": { label: "Permanently deleted an intern", icon: UserMinus, tone: "danger" },
  "intern.promoted_to_admin": { label: "Promoted an intern to manager", icon: ShieldPlus, tone: "accent" },
  "intern.reactivated": { label: "Reactivated an intern", icon: UserCheck, tone: "ok" },
  "performance_narrative.generated": { label: "Generated a performance narrative", icon: FileText, tone: "pulse" },
  "plan_deleted": { label: "Deleted a plan", icon: XCircle, tone: "danger" },
  "plan_generated": { label: "Generated a plan", icon: FileText, tone: "pulse" },
  "task.created": { label: "Created a task", icon: ListTodo, tone: "info" },
  "updated_draft": { label: "Updated a draft", icon: Pencil, tone: "neutral" },
  "user.changed_password": { label: "Changed a password", icon: KeyRound, tone: "neutral" },
};

function ActivityLog() {
  const logs = useQuery<AuditLog[]>({ queryKey: ["/api/audit-logs"] });
  const [showAll, setShowAll] = useState(false);
  const all = logs.data ?? [];
  const shown = showAll ? all : all.slice(0, 25);

  return (
    <Group title="Activity log" description="Security-relevant actions across the workspace, newest first. Recorded by the server; it can't be edited." footer={all.length > 0 ? `Showing ${shown.length} of ${all.length}. The server keeps the most recent 100.` : undefined}>
      {logs.isLoading ? (
        <div className="px-4 py-3.5"><SkeletonRows rows={5} /></div>
      ) : logs.error ? (
        <ErrorState compact message={(logs.error as Error).message} onRetry={() => logs.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState compact icon={<History />} title="Nothing recorded yet" description="Approvals, role changes, device sign-outs and password changes show up here." />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {shown.map((log) => {
              const meta = AUDIT_META[log.action] ?? { label: log.action.replace(/[._]/g, " "), icon: History, tone: "neutral" as Tone };
              const detail = typeof log.metadata?.deviceName === "string" ? log.metadata.deviceName : null;
              return (
                <li key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", toneClasses[meta.tone].bg, toneClasses[meta.tone].text)}><meta.icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{meta.label}</span>
                    {detail && <span className="block truncate text-[11.5px] text-ink-3">{detail}</span>}
                  </span>
                  <RelativeTime value={log.createdAt} className="t-num shrink-0 text-[11.5px] text-ink-3" live={false} />
                </li>
              );
            })}
          </ul>
          {all.length > shown.length && (
            <div className="px-4 py-2.5"><Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>Show all {all.length}</Button></div>
          )}
        </>
      )}
    </Group>
  );
}
