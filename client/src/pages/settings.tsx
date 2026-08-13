import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Laptop, Smartphone, Pencil, Check, X, ShieldAlert, History, User as UserIcon, Globe, Copy, Award } from "lucide-react";

interface SettingsProps {
  user: { id: string; name: string; email: string; role: string; companyId: string | null };
}

interface Device {
  id: string;
  name: string | null;
  platform: string | null;
  browser: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function DeviceRow({ device }: { device: Device }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.name || "");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const renameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/devices/${device.id}`, { name: name.trim() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Couldn't rename device", description: error.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/devices/${device.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      toast({ title: "Device access revoked" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't revoke device", description: error.message, variant: "destructive" });
    },
  });

  const isMobile = device.platform === "iOS" || device.platform === "Android";
  const Icon = isMobile ? Smartphone : Laptop;

  if (device.revokedAt) return null;

  return (
    <div className="flex items-center gap-4 p-4 border border-white/[0.08] rounded-lg" data-testid={`device-${device.id}`}>
      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-white/50" />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm max-w-xs"
              autoFocus
              data-testid={`input-rename-device-${device.id}`}
            />
            <button onClick={() => renameMutation.mutate()} disabled={!name.trim() || renameMutation.isPending} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded" data-testid={`button-save-rename-${device.id}`}>
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setEditing(false); setName(device.name || ""); }} className="p-1 text-white/40 hover:bg-[#141110]/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate" data-testid={`text-device-name-${device.id}`}>{device.name || "Unnamed device"}</p>
            {device.isCurrent && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">This device</Badge>}
            <button onClick={() => setEditing(true)} className="p-1 text-white/30 hover:text-white/50" data-testid={`button-rename-device-${device.id}`}>
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <p className="text-xs text-white/50 mt-0.5">
          First seen {formatDate(device.firstSeenAt)} &middot; Last active {formatDate(device.lastSeenAt)}
        </p>
      </div>
      {!device.isCurrent && (
        <Button
          variant="outline"
          size="sm"
          className="border-red-500/20 text-red-400 hover:bg-red-500/10 shrink-0"
          onClick={() => setConfirmRevoke(true)}
          data-testid={`button-revoke-device-${device.id}`}
        >
          Revoke
        </Button>
      )}
      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this device?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{device.name || "Unnamed device"}&rdquo; will be signed out immediately and won't be able to access your account until it logs in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { revokeMutation.mutate(); setConfirmRevoke(false); }}
              data-testid={`button-confirm-revoke-${device.id}`}
            >
              Revoke access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DevicesTab() {
  const { data: devices = [], isLoading } = useQuery<Device[]>({ queryKey: ["/api/devices"] });

  if (isLoading) {
    return <div className="text-sm text-white/40 py-8 text-center">Loading devices...</div>;
  }

  const active = devices.filter((d) => !d.revokedAt);

  if (active.length === 0) {
    return (
      <div className="text-center py-12">
        <ShieldAlert className="w-10 h-10 text-white/30 mx-auto mb-3" />
        <p className="text-sm text-white/50">No devices on record yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/50 mb-4">
        These are the devices that have signed in to your account. Revoking a device signs it out immediately.
      </p>
      {active.map((d) => <DeviceRow key={d.id} device={d} />)}
    </div>
  );
}

function AuditLogTab() {
  const { data: logs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/audit-logs"] });

  if (isLoading) {
    return <div className="text-sm text-white/40 py-8 text-center">Loading activity...</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-10 h-10 text-white/30 mx-auto mb-3" />
        <p className="text-sm text-white/50">No security events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log: any) => (
        <div key={log.id} className="flex items-center justify-between p-3 border border-white/[0.06] rounded-lg text-sm" data-testid={`audit-log-${log.id}`}>
          <span className="text-white/90 font-mono text-xs">{log.action}</span>
          <span className="text-white/40 text-xs">{formatDate(log.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

function ChangePasswordCard() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/auth/change-password", { currentPassword, newPassword });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Couldn't change password", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "New password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords don't match", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate();
  };

  return (
    <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Change Password</h3>
        <p className="text-xs text-white/50 mt-0.5">Update the password you use to log in.</p>
      </div>
      <div className="space-y-3 max-w-sm">
        <div>
          <label className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1 block">Current Password</label>
          <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} data-testid="input-current-password" />
        </div>
        <div>
          <label className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1 block">New Password</label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" data-testid="input-new-password" />
        </div>
        <div>
          <label className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1 block">Confirm New Password</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            data-testid="input-confirm-password"
          />
        </div>
        <Button onClick={handleSubmit} disabled={changePasswordMutation.isPending} data-testid="button-change-password">
          {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
        </Button>
      </div>
    </div>
  );
}

interface MeResponse {
  publicProfileEnabled: boolean;
  publicProfileSlug: string | null;
  completionBadgeAwardedAt: string | null;
}

function PublicProfileCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useQuery<MeResponse>({ queryKey: ["/api/auth/me"] });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PUT", "/api/settings/public-profile", { enabled });
      return res.json();
    },
    onSuccess: (data: { publicProfileEnabled: boolean; publicProfileSlug: string | null }) => {
      queryClient.setQueryData(["/api/auth/me"], (prev: MeResponse | undefined) =>
        prev ? { ...prev, ...data } : prev
      );
      toast({ title: data.publicProfileEnabled ? "Public profile enabled" : "Public profile disabled" });
    },
    onError: (err: any) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const shareUrl = me?.publicProfileSlug ? `${window.location.origin}/i/${me.publicProfileSlug}` : null;

  return (
    <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-white/50 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">Public Profile</p>
            <p className="text-xs text-white/50 mt-0.5">
              Share a public page with your completed work and skills — great for LinkedIn or a resume.
            </p>
          </div>
        </div>
        <Switch
          checked={!!me?.publicProfileEnabled}
          onCheckedChange={(checked) => toggleMutation.mutate(checked)}
          disabled={toggleMutation.isPending}
          data-testid="switch-public-profile"
        />
      </div>

      {me?.completionBadgeAwardedAt && (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <Award className="w-3.5 h-3.5" />
          Your admin has awarded you a completion badge — it'll show on your public profile.
        </div>
      )}

      {shareUrl && me?.publicProfileEnabled && (
        <div className="flex items-center gap-2 bg-[#0B0A09] border border-white/[0.08] rounded-lg px-3 py-2">
          <span className="text-sm text-white/70 flex-1 truncate" data-testid="text-public-profile-url">{shareUrl}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast({ title: "Link copied" });
            }}
            data-testid="button-copy-public-profile-url"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Settings({ user }: SettingsProps) {
  return (
    <div className="min-h-screen bg-[#0B0A09]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-settings-title">Settings</h1>
          <p className="text-white/50 text-sm mt-1">Manage your profile, devices, and security</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="profile" data-testid="tab-profile"><UserIcon className="w-4 h-4 mr-1.5" />Profile</TabsTrigger>
            <TabsTrigger value="devices" data-testid="tab-devices"><Laptop className="w-4 h-4 mr-1.5" />Devices</TabsTrigger>
            {user.role === "admin" && (
              <TabsTrigger value="activity" data-testid="tab-activity"><History className="w-4 h-4 mr-1.5" />Activity Log</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide">Name</label>
                <p className="text-sm text-white mt-1" data-testid="text-profile-name">{user.name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide">Email</label>
                <p className="text-sm text-white mt-1" data-testid="text-profile-email">{user.email}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide">Role</label>
                <p className="text-sm text-white mt-1 capitalize" data-testid="text-profile-role">{user.role === "admin" ? "Admin" : user.role}</p>
              </div>
            </div>

            <div className="mt-4">
              <PublicProfileCard />
            </div>

            <div className="mt-4">
              <ChangePasswordCard />
            </div>
          </TabsContent>

          <TabsContent value="devices" className="mt-4">
            <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6">
              <DevicesTab />
            </div>
          </TabsContent>

          {user.role === "admin" && (
            <TabsContent value="activity" className="mt-4">
              <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6">
                <AuditLogTab />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
