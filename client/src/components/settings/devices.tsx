import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Smartphone, MonitorDot, Pencil, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Pill, RelativeTime, Skeleton } from "@/components/kit";

export interface Device {
  id: string;
  deviceId?: string;
  name: string | null;
  platform: string | null;
  browser: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

export const DEVICES_KEY = ["/api/devices"] as const;

export function useDevices() {
  const q = useQuery<Device[]>({ queryKey: DEVICES_KEY });
  const active = (q.data ?? []).filter((d) => !d.revokedAt);
  return { ...q, active };
}

// The Companion signs in with User-Agent "InternOps-Companion/…", which the
// server's coarse parser doesn't recognise, so unless the device has been
// named we can only tell by the name. Unrecognised = both fields unknown.
export function isCompanionDevice(d: Device): boolean {
  return /companion/i.test(d.name ?? "");
}
export function isUnrecognisedDevice(d: Device): boolean {
  return !isCompanionDevice(d) && (d.platform ?? "Unknown") === "Unknown" && (d.browser ?? "Unknown") === "Unknown";
}

function deviceIcon(d: Device) {
  if (isCompanionDevice(d)) return MonitorDot;
  if (d.platform === "iOS" || d.platform === "Android") return Smartphone;
  return Laptop;
}

export function DeviceRow({ device, className }: { device: Device; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.name ?? "");
  const [confirm, setConfirm] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const rename = useMutation({
    mutationFn: () => api("PUT", `/api/devices/${device.id}`, { name: name.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: DEVICES_KEY }); setEditing(false); toast({ title: "Device renamed" }); },
    onError: (err: Error) => toast({ title: "Couldn't rename device", description: err.message, variant: "destructive" }),
  });
  const revoke = useMutation({
    mutationFn: () => api("DELETE", `/api/devices/${device.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: DEVICES_KEY }); setConfirm(false); toast({ title: "Device signed out" }); },
    onError: (err: Error) => toast({ title: "Couldn't sign out device", description: err.message, variant: "destructive" }),
  });

  const Icon = deviceIcon(device);
  const label = device.name || "Unnamed device";
  const detail = [device.browser, device.platform].filter((s) => s && s !== "Unknown").join(" · ");
  const companion = isCompanionDevice(device);

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3.5", className)}>
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md", companion ? "bg-work-soft text-work" : "bg-surface-2 text-ink-3")}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) rename.mutate(); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 max-w-xs md:text-[13px]" autoFocus aria-label="Device name" maxLength={80}
              onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); setName(device.name ?? ""); } }} />
            <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save name" disabled={!name.trim() || rename.isPending} className="text-ok"><Check className="h-4 w-4" /></Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel rename" onClick={() => { setEditing(false); setName(device.name ?? ""); }}><X className="h-4 w-4" /></Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[13.5px] font-medium text-ink">{label}</span>
            {device.isCurrent && <Pill tone="ok">This device</Pill>}
            {companion && <Pill tone="work">Companion</Pill>}
            <Button size="icon-xs" variant="ghost" aria-label={`Rename ${label}`} title="Rename" className="text-ink-4 hover:text-ink" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
          </div>
        )}
        <p className="mt-0.5 text-[12px] text-ink-3">
          {detail && <>{detail} · </>}
          Active <RelativeTime value={device.lastSeenAt} /> · First seen <span className="t-num">{formatDate(device.firstSeenAt, { month: "short", day: "numeric", year: "numeric" })}</span>
        </p>
      </div>
      {!device.isCurrent && (
        <Button variant="outline" size="sm" className="shrink-0 text-danger hover:bg-danger-soft" onClick={() => setConfirm(true)}>Sign out</Button>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Sign out “${label}”?`}
        description="It loses access immediately and will need to sign in again."
        confirmLabel="Sign out device"
        destructive
        pending={revoke.isPending}
        onConfirm={() => revoke.mutate()}
      />
    </div>
  );
}

export function DevicesSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy aria-label="Loading devices">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-64 max-w-full" /></div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
