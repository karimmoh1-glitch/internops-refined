import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Github } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, ErrorState, Pill } from "@/components/kit";
import { Field, Group, LinkBox, Row, RowsSkeleton, SectionHeader, Toggle, Value } from "./primitives";

interface Company { id: string; name: string; slug: string | null; acceptingApplications: boolean; githubConnected: boolean }
const COMPANY_KEY = ["/api/company"] as const;

// The GitHub token is write-only on the server; /api/company only says
// whether one is set.
export function WorkspaceSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const company = useQuery<Company>({ queryKey: COMPANY_KEY, staleTime: 30_000 });

  const [githubOverride, setGithub] = useState<boolean | null>(null);
  const github = githubOverride ?? (company.data ? company.data.githubConnected : null);
  const [token, setToken] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const accepting = useMutation({
    mutationFn: (accepting: boolean) => api<Company & { githubConnected: boolean }>("PUT", "/api/company/accepting-applications", { accepting }),
    onSuccess: (data) => {
      qc.setQueryData<Company>(COMPANY_KEY, data);
      qc.invalidateQueries({ queryKey: COMPANY_KEY });
      setGithub(!!data.githubConnected);
      toast({ title: data.acceptingApplications ? "Public applications are open" : "Public applications are closed" });
    },
    onError: (err: Error) => toast({ title: "Couldn't update applications", description: err.message, variant: "destructive" }),
  });

  const saveToken = useMutation({
    mutationFn: (githubToken: string) => api<{ message: string }>("PUT", "/api/company/github-token", { githubToken }),
    onSuccess: (data, githubToken) => {
      setGithub(!!githubToken);
      qc.invalidateQueries({ queryKey: COMPANY_KEY });
      setToken("");
      setConfirmRemove(false);
      toast({ title: data?.message ?? (githubToken ? "GitHub token saved" : "GitHub token removed") });
    },
    onError: (err: Error) => toast({ title: "Couldn't update GitHub token", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <SectionHeader title="Workspace" description="Settings that apply to everyone in the workspace. Only managers see this page." />

      {company.isLoading ? (
        <Group><RowsSkeleton rows={2} /></Group>
      ) : company.error ? (
        <Group><ErrorState compact message={company.error.message} onRetry={() => company.refetch()} /></Group>
      ) : (
        <>
          <Group footer="The workspace name was set when the workspace was created and can't be changed from here.">
            <Row label="Workspace name" control={<Value>{company.data?.name ?? "—"}</Value>} />
          </Group>

          <Group title="Public applications" description="When open, anyone with the link can apply to join as an intern. Applications land in People → Applications for review.">
            <Row
              label="Accept applications"
              htmlFor="accepting-applications"
              description={company.data?.acceptingApplications ? "The application page is live." : "The application page shows as closed."}
              control={<Toggle id="accepting-applications" checked={!!company.data?.acceptingApplications} pending={accepting.isPending} onCheckedChange={(v) => accepting.mutate(v)} />}
            />
            {company.data?.acceptingApplications && company.data.slug && (
              <div className="px-4 py-3.5"><LinkBox path={`/apply/${company.data.slug}`} label="application link" /></div>
            )}
          </Group>
        </>
      )}

      <Group
        title={<span className="inline-flex items-center gap-2"><Github className="h-4 w-4 text-ink-3" />GitHub</span>}
        description="A personal access token lets InternOps read recent commits for projects linked to a repository. It's stored server-side and never shown again."
        footer={github === null ? "Status is confirmed when you save a token or change a workspace setting." : undefined}
      >
        <Row
          label="Connection"
          control={github === null ? <Value><span className="text-ink-3">Unknown</span></Value> : github ? <Pill tone="ok">Connected</Pill> : <Pill>Not connected</Pill>}
        />
        <div className="px-4 py-3.5">
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); if (token.trim()) saveToken.mutate(token.trim()); }}>
            <Field label={github ? "Replace token" : "Set token"} htmlFor="github-token" className="flex-1" hint="Needs read access to the repositories your projects link to.">
              <Input id="github-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…" spellCheck={false} />
            </Field>
            <div className="flex gap-2 sm:pb-[22px]">
              <Button type="submit" disabled={!token.trim() || saveToken.isPending}>{saveToken.isPending ? "Saving…" : "Save"}</Button>
              {github !== false && <Button type="button" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirmRemove(true)} disabled={saveToken.isPending}>Remove</Button>}
            </div>
          </form>
        </div>
      </Group>

      <Group>
        <Row
          label="People"
          description="Invite managers and interns, review applications and manage alumni."
          control={<Button asChild variant="outline" size="sm"><Link href="/people">Open People<ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
        />
      </Group>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove the GitHub token?"
        description="Projects linked to repositories stop showing recent commits until a new token is saved."
        confirmLabel="Remove token"
        destructive
        pending={saveToken.isPending}
        onConfirm={() => saveToken.mutate("")}
      />
    </div>
  );
}
