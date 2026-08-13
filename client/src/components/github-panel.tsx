import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown, ChevronRight, Loader2, ExternalLink,
  GitCommit, GitPullRequest, Github, Link2, Settings, X, Check
} from "lucide-react";

interface GitHubPanelProps {
  projectId: string;
  githubRepoUrl?: string | null;
  isAdmin?: boolean;
  companyId?: string;
  onCommitSelect?: (sha: string) => void;
}

export default function GitHubPanel({ projectId, githubRepoUrl, isAdmin, companyId, onCommitSelect }: GitHubPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"commits" | "pulls">("commits");

  const hasRepo = !!githubRepoUrl;

  const { data: commits = [], isLoading: loadingCommits } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/github/commits`],
    enabled: expanded && hasRepo && activeTab === "commits",
    staleTime: 60000,
  });

  const { data: pulls = [], isLoading: loadingPulls } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/github/pulls`],
    enabled: expanded && hasRepo && activeTab === "pulls",
    staleTime: 60000,
  });

  if (!hasRepo && !isAdmin) return null;

  return (
    <div className="bg-[#141110] border border-white/[0.08] rounded-xl shadow-sm" data-testid="github-panel">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#141110]/[0.06] transition-colors rounded-xl"
        data-testid="button-toggle-github"
      >
        <div className="flex items-center gap-2">
          <Github className="w-4 h-4 text-white/70" />
          <span className="text-sm font-semibold text-white">GitHub</span>
          {hasRepo && (
            <span className="text-xs text-white/40 truncate max-w-[200px]">{githubRepoUrl}</span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          {!hasRepo ? (
            <div className="p-4 text-center">
              <Github className="w-8 h-8 text-white/30 mx-auto mb-2" />
              <p className="text-sm text-white/50 mb-1">No repository linked</p>
              {isAdmin && <p className="text-xs text-white/40">Link a GitHub repo from the project edit modal.</p>}
            </div>
          ) : (
            <>
              <div className="flex border-b border-white/[0.06]">
                <button
                  onClick={() => setActiveTab("commits")}
                  className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                    activeTab === "commits" ? "text-white border-b-2 border-white" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <GitCommit className="w-3.5 h-3.5" />
                  Commits
                </button>
                <button
                  onClick={() => setActiveTab("pulls")}
                  className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                    activeTab === "pulls" ? "text-white border-b-2 border-white" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  Pull Requests
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {activeTab === "commits" && (
                  loadingCommits ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-white/40" /></div>
                  ) : commits.length === 0 ? (
                    <div className="p-4 text-center text-xs text-white/40">No commits found</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {commits.map((commit: any) => (
                        <div
                          key={commit.fullSha}
                          className={`px-4 py-2.5 hover:bg-[#141110]/[0.06] transition-colors ${onCommitSelect ? "cursor-pointer" : ""}`}
                          onClick={() => onCommitSelect?.(commit.sha)}
                          data-testid={`commit-${commit.sha}`}
                        >
                          <div className="flex items-start gap-2">
                            <code className="text-xs text-blue-400 font-mono shrink-0 bg-blue-500/10 px-1.5 py-0.5 rounded">
                              {commit.sha}
                            </code>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white/90 truncate">{commit.message}</p>
                              <p className="text-[10px] text-white/40 mt-0.5">
                                {commit.author} · {commit.date ? new Date(commit.date).toLocaleDateString() : ""}
                              </p>
                            </div>
                            <a
                              href={commit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-white/30 hover:text-blue-500 shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {activeTab === "pulls" && (
                  loadingPulls ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-white/40" /></div>
                  ) : pulls.length === 0 ? (
                    <div className="p-4 text-center text-xs text-white/40">No pull requests found</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {pulls.map((pr: any) => (
                        <a
                          key={pr.number}
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-4 py-2.5 hover:bg-[#141110]/[0.06] transition-colors"
                          data-testid={`pr-${pr.number}`}
                        >
                          <div className="flex items-start gap-2">
                            <Badge
                              className={`text-[10px] shrink-0 ${
                                pr.merged ? "bg-purple-100 text-purple-400 border-purple-500/20" :
                                pr.state === "open" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                "bg-red-100 text-red-400 border-red-500/20"
                              }`}
                            >
                              #{pr.number}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white/90 truncate">{pr.title}</p>
                              <p className="text-[10px] text-white/40 mt-0.5">
                                {pr.author} · {pr.merged ? "Merged" : pr.state} · {new Date(pr.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <ExternalLink className="w-3 h-3 text-white/30 shrink-0" />
                          </div>
                        </a>
                      ))}
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Admin settings component for GitHub token
export function GitHubTokenSettings({ companyId }: { companyId: string }) {
  const [editing, setEditing] = useState(false);
  const [token, setToken] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/company/github-token", { githubToken: token.trim() || null });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: token.trim() ? "GitHub token saved" : "GitHub token removed" });
      setEditing(false);
      setToken("");
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex items-center gap-2" data-testid="github-token-settings">
      {editing ? (
        <>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
            className="text-xs h-7 max-w-[200px]"
            data-testid="input-github-token"
          />
          <Button size="sm" className="h-7 text-xs" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(false); setToken(""); }}>
            <X className="w-3 h-3" />
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(true)} data-testid="button-configure-github">
          <Settings className="w-3 h-3 mr-1" />
          GitHub Token
        </Button>
      )}
    </div>
  );
}

// Repo URL input for project edit modal
export function GitHubRepoInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1">GitHub Repository</label>
      <div className="relative">
        <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="pl-9 border-white/[0.15] text-sm"
          data-testid="input-github-repo"
        />
      </div>
    </div>
  );
}
