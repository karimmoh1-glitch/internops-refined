import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, ErrorState } from "@/components/kit";
import { type Me, ME_KEY, Group, Row, SectionHeader, Toggle, Value, LinkBox, RowsSkeleton } from "./primitives";

export function ProfileSection() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const me = useQuery<Me>({ queryKey: ME_KEY });

  const publicProfile = useMutation({
    mutationFn: (enabled: boolean) => api<{ publicProfileEnabled: boolean; publicProfileSlug: string | null }>("PUT", "/api/settings/public-profile", { enabled }),
    onSuccess: (data) => {
      qc.setQueryData<Me>(ME_KEY, (prev) => (prev ? { ...prev, ...data } : prev));
      toast({ title: data.publicProfileEnabled ? "Public profile is on" : "Public profile is off" });
    },
    onError: (err: Error) => toast({ title: "Couldn't update public profile", description: err.message, variant: "destructive" }),
  });

  if (!user) return null;
  const roleLabel = user.role === "admin" ? "Manager" : "Intern";

  return (
    <div className="space-y-5">
      <SectionHeader title="Profile" description="Who you are in this workspace, and whether anyone outside it can see your work." />

      <Group footer="Your email is your sign-in identity and can't be changed here.">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Avatar name={user.name} size="xl" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[12.5px] text-ink-3">{roleLabel}</p>
          </div>
        </div>
        <Row label="Name" control={<NameEditor name={user.name} onSaved={() => void refresh()} />} />
        <Row label="Email" control={<Value>{user.email}</Value>} />
        <Row label="Role" description={user.role === "admin" ? "Managers see every intern, project and signal in the workspace." : "Interns see their own tasks, projects and shifts."} control={<Value>{roleLabel}</Value>} />
      </Group>

      <Group title="Public profile" description="A page anyone with the link can open. It lists your completed work and skills — nothing about activity or shifts. Off by default.">
        {me.isLoading ? (
          <RowsSkeleton rows={1} />
        ) : me.error ? (
          <ErrorState compact message={(me.error as Error).message} onRetry={() => me.refetch()} />
        ) : (
          <>
            <Row
              label="Share a public page"
              htmlFor="public-profile"
              description={me.data?.publicProfileEnabled ? "Your page is live at the link below." : "Nobody can see your page until you turn this on."}
              control={<Toggle id="public-profile" checked={!!me.data?.publicProfileEnabled} pending={publicProfile.isPending} onCheckedChange={(v) => publicProfile.mutate(v)} />}
            />
            {me.data?.publicProfileEnabled && me.data.publicProfileSlug && (
              <div className="px-4 py-3.5">
                <LinkBox path={`/i/${me.data.publicProfileSlug}`} label="public profile link" />
              </div>
            )}
            {me.data?.completionBadgeAwardedAt && (
              <div className="flex items-start gap-2 px-4 py-3 text-[12.5px] text-ink-2">
                <Award className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                <span>A manager awarded you a completion badge. It shows on your public page when the page is on.</span>
              </div>
            )}
          </>
        )}
      </Group>
    </div>
  );
}


function NameEditor({ name, onSaved }: { name: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const save = useMutation({
    mutationFn: () => api("PUT", "/api/settings/profile", { name: value.trim() }),
    onSuccess: () => { setEditing(false); onSaved(); toast({ title: "Name updated" }); },
    onError: (err: Error) => toast({ title: "Couldn't update your name", description: err.message, variant: "destructive" }),
  });
  if (!editing) return <span className="inline-flex items-center gap-2"><Value>{name}</Value><Button variant="ghost" size="xs" onClick={() => { setValue(name); setEditing(true); }}>Edit</Button></span>;
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (value.trim().length >= 2) save.mutate(); }}>
      <label htmlFor="profile-name" className="sr-only">Name</label>
      <Input id="profile-name" autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} className="h-8 w-48 text-[13px]" />
      <Button type="submit" size="xs" disabled={save.isPending || value.trim().length < 2}>{save.isPending ? "Saving…" : "Save"}</Button>
      <Button type="button" variant="ghost" size="xs" onClick={() => setEditing(false)} disabled={save.isPending}>Cancel</Button>
    </form>
  );
}
