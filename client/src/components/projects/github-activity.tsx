import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, GitCommit, GitPullRequest, Github } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, Pill, Section, Segmented, SkeletonRows } from "@/components/kit";
import { invalidateProject } from "./dialogs";
import { PROJECT_KEYS } from "./types";

interface Commit { sha: string; fullSha: string; message: string; author: string; date: string; url: string }
interface Pull { number: number; title: string; state: string; merged: boolean; author: string; updatedAt: string; url: string }

function RepoForm({ projectId, current, onDone }: { projectId: string; current: string; onDone?: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [url, setUrl] = useState(current);
  const save = useMutation({
    mutationFn: () => api("PUT", `/api/projects/${projectId}/github`, { githubRepoUrl: url.trim() || null }),
    onSuccess: () => {
      invalidateProject(qc, projectId);
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.commits(projectId) });
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.pulls(projectId) });
      toast({ title: url.trim() ? "Repository linked" : "Repository unlinked" });
      onDone?.();
    },
    onError: (e: Error) => toast({ title: "Couldn't link repository", description: e.message, variant: "destructive" }),
  });
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (!save.isPending) save.mutate(); }}>
      <Label htmlFor={`repo-${projectId}`} className="text-[13px] text-ink-2">Repository URL</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Github className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
          <Input id={`repo-${projectId}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" className="pl-8" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="default" disabled={save.isPending || url.trim() === current}>{save.isPending ? "Checking…" : "Save"}</Button>
          {onDone && <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>}
        </div>
      </div>
      <p className="text-xs text-ink-3">Commits and pull requests are read with the company's GitHub token from Settings. Private repos need a token with repo scope.</p>
    </form>
  );
}

export function GitHubActivity({ projectId, repoUrl, isAdmin }: { projectId: string; repoUrl: string | null | undefined; isAdmin: boolean }) {
  const [tab, setTab] = useState<"commits" | "pulls">("commits");
  const [editing, setEditing] = useState(false);
  const hasRepo = !!repoUrl;
  const commits = useQuery<Commit[]>({ queryKey: PROJECT_KEYS.commits(projectId), enabled: hasRepo && tab === "commits", staleTime: 60_000 });
  const pulls = useQuery<Pull[]>({ queryKey: PROJECT_KEYS.pulls(projectId), enabled: hasRepo && tab === "pulls", staleTime: 60_000 });

  if (!hasRepo) {
    return (
      <Section title="GitHub activity">
        {isAdmin ? (
          <div className="space-y-4">
            <EmptyState compact icon={<Github />} title="No repository linked" description="Link the repo this project lives in and recent commits and pull requests show up here for both of you." />
            <RepoForm projectId={projectId} current="" />
          </div>
        ) : (
          <EmptyState compact icon={<Github />} title="No repository linked" description="Your manager can link a GitHub repository to this project. Once they do, your commits and pull requests appear here." />
        )}
      </Section>
    );
  }

  const repoLabel = repoUrl!.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "");

  return (
    <Section
      title="GitHub activity"
      description={<a href={repoUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink hover:underline underline-offset-2">{repoLabel}<ExternalLink className="h-3 w-3" /></a>}
      actions={<>
        <Segmented value={tab} onChange={setTab} options={[{ value: "commits", label: "Commits" }, { value: "pulls", label: "Pull requests" }]} />
        {isAdmin && <Button variant="ghost" size="xs" onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Change"}</Button>}
      </>}
      flush
    >
      {editing && isAdmin && <div className="border-b border-line p-4"><RepoForm projectId={projectId} current={repoUrl!} onDone={() => setEditing(false)} /></div>}
      {tab === "commits" ? (
        commits.isLoading ? <div className="p-4"><SkeletonRows rows={5} /></div>
        : commits.error ? <ErrorState compact title="Couldn't read commits" message={(commits.error as Error).message} onRetry={() => commits.refetch()} />
        : (commits.data ?? []).length === 0 ? <EmptyState compact icon={<GitCommit />} title="No commits yet" description="The default branch has no recent commits, or the token can't see this repository." />
        : (
          <ol className="divide-y divide-line">
            {(commits.data ?? []).map((c) => (
              <li key={c.fullSha}>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors">
                  <code className="t-num mt-0.5 shrink-0 rounded-sm bg-bg-sunken px-1.5 py-px text-[11px] text-accent">{c.sha}</code>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{c.message}</span>
                    <span className="block text-xs text-ink-3">{c.author}{c.date ? ` · ${formatDate(c.date)}` : ""}</span>
                  </span>
                  <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-ink-4" />
                </a>
              </li>
            ))}
          </ol>
        )
      ) : (
        pulls.isLoading ? <div className="p-4"><SkeletonRows rows={5} /></div>
        : pulls.error ? <ErrorState compact title="Couldn't read pull requests" message={(pulls.error as Error).message} onRetry={() => pulls.refetch()} />
        : (pulls.data ?? []).length === 0 ? <EmptyState compact icon={<GitPullRequest />} title="No pull requests" description="Nothing has been opened against this repository recently." />
        : (
          <ol className="divide-y divide-line">
            {(pulls.data ?? []).map((p) => (
              <li key={p.number}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors">
                  <Pill tone={p.merged ? "pulse" : p.state === "open" ? "ok" : "danger"} className="mt-0.5 shrink-0 t-num">#{p.number}</Pill>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{p.title}</span>
                    <span className="block text-xs text-ink-3">{p.author} · {p.merged ? "merged" : p.state} · {formatDate(p.updatedAt)}</span>
                  </span>
                  <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-ink-4" />
                </a>
              </li>
            ))}
          </ol>
        )
      )}
    </Section>
  );
}
