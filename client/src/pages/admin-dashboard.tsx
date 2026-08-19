import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserPlus, Briefcase, AlertCircle, ChevronDown, ChevronRight,
  Loader2, X, Copy, Clock, MessageSquare, CheckCircle2, Pencil, Trash2,
  Target, BarChart3, Filter, ListTodo, Sparkles, Send, ShieldPlus, Activity, Download,
  AlertTriangle,
} from "lucide-react";
import { AdminDashboardSkeleton } from "@/components/dashboard-skeleton";
import SearchFilterBar from "@/components/search-filter-bar";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import CommandPalette, { useAdminCommands } from "@/components/command-palette";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ProjectStatusPieChart, CompletionRateBarChart, WeeklyActivityLineChart, HoursComparisonChart, TaskStatusPieChart, TaskCompletionByInternChart } from "@/components/analytics-charts";
import GitHubPanel, { GitHubTokenSettings, GitHubRepoInput } from "@/components/github-panel";
import ApplicationsPanel from "@/components/applications-panel";
import ProjectProposalsPanel from "@/components/project-proposals-panel";
import PulseScoreCard from "@/components/pulse-score";
import { exportTeamReport } from "@/lib/export-report";

interface AdminDashboardProps {
  user: { id: string; name: string; role: string; companyId: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  assigned: "bg-white/10 text-white/70 border-white/[0.08]",
  planning: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  submitted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  completed: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  draft: "bg-white/10 text-white/60 border-white/[0.08]",
  pending_approval: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rejected: "bg-white/10 text-white/50 border-white/[0.08]",
};

function statusBadge(status: string) {
  const cls = STATUS_COLORS[status] || STATUS_COLORS.assigned;
  const words = status.split("_");
  const label = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return <Badge variant="outline" className={`${cls} text-xs font-medium`} data-testid={`badge-status-${status}`}>{label}</Badge>;
}

function formatLogDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatLogDate(dateStr);
}

function getSubtaskCompletion(planWeeks: any[], weeklyLogs: any[]): { completed: number; total: number; pct: number } {
  let total = 0;
  let completed = 0;
  const subtasksWithLogs = new Set<string>();
  weeklyLogs.forEach((l: any) => {
    if (l.subtaskIndex !== null && l.subtaskIndex !== undefined) {
      subtasksWithLogs.add(`${l.weekNumber}-${l.subtaskIndex}`);
    }
  });
  planWeeks.forEach((week: any) => {
    const deliverables = week.deliverables || [];
    total += deliverables.length;
    deliverables.forEach((_: any, idx: number) => {
      if (subtasksWithLogs.has(`${week.weekNumber}-${idx}`)) completed++;
    });
  });
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, pct };
}

function PlanReviewCard({ project, version, content, weeks, comment, onCommentChange, expandedWeeks, onToggleWeek, onApprove, onRequestRevision, onAddComment, isApproving, isRequestingRevision }: any) {
  const { data: comments = [] } = useQuery<any[]>({
    queryKey: ["/api/plan-versions", version.id, "comments"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/plan-versions/${version.id}/comments`);
      return res.json();
    },
  });

  return (
    <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm" data-testid={`plan-review-${project.id}`}>
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white" data-testid={`text-review-title-${project.id}`}>{project.title}</h3>
          {statusBadge(version.status)}
        </div>
        <div className="flex items-center gap-2 mb-1" data-testid={`text-review-intern-${project.id}`}>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-300 rounded-full text-sm font-semibold border border-blue-500/20">
            <Users className="w-3.5 h-3.5" /> {project.internName}
          </span>
          <span className="text-sm text-white/40">{project.internEmail}</span>
        </div>
        <p className="text-sm text-white/50 mt-1">
          Version {version.versionNumber} · {content.numberOfWeeks} weeks · {content.totalPlannedHours}h planned · {content.hoursPerDay}h/day, {content.daysPerWeek} days/week
        </p>
      </div>

      <div className="p-5 space-y-3">
        <h4 className="text-sm font-semibold text-white/70">Weekly Plan</h4>
        {weeks.map((week: any) => {
          const key = `${version.id}-w${week.weekNumber}`;
          const isOpen = expandedWeeks[key];
          return (
            <div key={key} className="border border-white/[0.06] rounded-lg">
              <button className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.04] transition-colors" onClick={() => onToggleWeek(key)} data-testid={`button-toggle-week-${version.id}-${week.weekNumber}`}>
                <span className="text-sm font-medium text-white/90">Week {week.weekNumber}: {week.milestone}</span>
                {isOpen ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 text-sm text-white/60">
                  <p><span className="font-medium text-white/70">Hours:</span> {week.hours}h</p>
                  <p><span className="font-medium text-white/70">Success Criteria:</span> {week.successCriteria}</p>
                  <div>
                    <span className="font-medium text-white/70">Deliverables:</span>
                    <ul className="list-disc ml-5 mt-1">
                      {(week.deliverables || []).map((d: string, i: number) => (<li key={i}>{d}</li>))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {comments.length > 0 && (
        <div className="px-5 pb-3">
          <h4 className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-1">
            <MessageSquare className="w-4 h-4" /> Comments
          </h4>
          <div className="space-y-2">
            {comments.map((c: any) => (
              <div key={c.id} className="bg-background rounded p-2 text-sm" data-testid={`comment-${c.id}`}>
                <p className="text-white/90">{c.content}</p>
                <p className="text-white/40 text-xs mt-1">{formatLogDate(c.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-5 border-t border-white/[0.06] space-y-3">
        <Textarea placeholder="Add a comment (required for revision request)..." value={comment} onChange={(e) => onCommentChange(e.target.value)} className="border-white/[0.15] text-sm" rows={3} data-testid={`input-review-comment-${project.id}`} />
        <div className="flex items-center gap-2">
          <Button onClick={onApprove} disabled={isApproving} size="lg" className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold px-6 shadow-sm hover:shadow-md transition-all" data-testid={`button-approve-${project.id}`}>
            {isApproving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
            Approve Plan
          </Button>
          <Button onClick={onRequestRevision} disabled={isRequestingRevision} variant="outline" className="border-amber-300 text-amber-400 hover:bg-amber-500/10" data-testid={`button-request-revision-${project.id}`}>
            {isRequestingRevision ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Request Revision
          </Button>
          <Button onClick={onAddComment} variant="outline" className="border-white/[0.15] text-white/60 hover:bg-white/[0.04] ml-auto" data-testid={`button-add-comment-${project.id}`}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Add Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

function InternProjectDetail({ project }: { project: any }) {
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [logCommentInputs, setLogCommentInputs] = useState<Record<string, string>>({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title || "");
  const [editIdea, setEditIdea] = useState(project.idea || "");
  const [editMinHours, setEditMinHours] = useState(String(project.minimumTotalHours || ""));
  const [editGithubUrl, setEditGithubUrl] = useState(project.githubRepoUrl || "");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const saveGithubUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/projects/${project.id}/github`, { githubRepoUrl: editGithubUrl.trim() || null });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }); },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const editProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/projects/${project.id}`, { title: editTitle.trim(), idea: editIdea.trim(), minimumTotalHours: Number(editMinHours) });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Project updated" });
      // Also save GitHub URL if changed
      if (editGithubUrl !== (project.githubRepoUrl || "")) {
        saveGithubUrlMutation.mutate();
      }
      setShowEditModal(false);
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("DELETE", `/api/projects/${project.id}`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }); toast({ title: "Project deleted" }); setShowDeleteConfirm(false); },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const { data: logComments = [] } = useQuery<any[]>({
    queryKey: ["/api/log-comments/project", project.id],
    queryFn: async () => { const res = await apiRequest("GET", `/api/log-comments/project/${project.id}`); return res.json(); },
    enabled: project.status === "active",
  });

  const commentsByLogId: Record<string, any[]> = {};
  logComments.forEach((c: any) => {
    if (!commentsByLogId[c.logId]) commentsByLogId[c.logId] = [];
    commentsByLogId[c.logId].push(c);
  });

  const addLogCommentMutation = useMutation({
    mutationFn: async ({ logId, content }: { logId: string; content: string }) => { const res = await apiRequest("POST", "/api/log-comments", { logId, content }); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/log-comments/project", project.id] }); toast({ title: "Comment added" }); },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const [planComment, setPlanComment] = useState("");
  const versions = project.versions || [];
  const latestVersion = versions.sort((a: any, b: any) => b.versionNumber - a.versionNumber)[0];

  const { data: planComments = [] } = useQuery<any[]>({
    queryKey: ["/api/plan-versions", latestVersion?.id, "comments"],
    queryFn: async () => { const res = await apiRequest("GET", `/api/plan-versions/${latestVersion.id}/comments`); return res.json(); },
    enabled: !!latestVersion?.id,
  });

  const addPlanCommentMutation = useMutation({
    mutationFn: async ({ versionId, content }: { versionId: string; content: string }) => { const res = await apiRequest("POST", `/api/plan-versions/${versionId}/comments`, { content }); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plan-versions", latestVersion?.id, "comments"] });
      toast({ title: "Comment added to plan" });
      setPlanComment("");
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });
  const approvedVersion = versions.find((v: any) => v.status === "approved") || latestVersion;
  const content = approvedVersion?.contentJson || {};
  const planWeeks: any[] = content.weeks || [];
  const weeklyLogs: any[] = project.weeklyLogs || [];

  const logsByWeek: Record<number, any[]> = {};
  weeklyLogs.forEach((log: any) => {
    if (!logsByWeek[log.weekNumber]) logsByWeek[log.weekNumber] = [];
    logsByWeek[log.weekNumber].push(log);
  });
  Object.values(logsByWeek).forEach((logs) =>
    logs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );

  const subtaskCompletion = getSubtaskCompletion(planWeeks, weeklyLogs);
  const toggleWeek = (key: string) => setExpandedWeeks((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm" data-testid={`project-detail-${project.id}`}>
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-white truncate" data-testid={`text-detail-title-${project.id}`}>{project.title}</h4>
              {statusBadge(project.status)}
              {approvedVersion && <span className="text-xs text-white/40">v{approvedVersion.versionNumber}</span>}
            </div>
            <p className="text-sm text-white/50 truncate">{project.idea}</p>
            {content.totalPlannedHours && (
              <p className="text-xs text-white/40 mt-1">
                {content.totalPlannedHours}h planned · {content.hoursPerDay}h/day · {content.daysPerWeek} days/week · {content.numberOfWeeks} weeks
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-3 shrink-0">
            <button onClick={() => { setEditTitle(project.title); setEditIdea(project.idea); setEditMinHours(String(project.minimumTotalHours || "")); setEditGithubUrl(project.githubRepoUrl || ""); setShowEditModal(true); }} className="p-1.5 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors" data-testid={`button-edit-project-${project.id}`} title="Edit project">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" data-testid={`button-delete-project-${project.id}`} title="Delete project">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {project.status === "active" && subtaskCompletion.total > 0 && (
          <div className="mt-3 p-3 bg-background rounded-lg">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-white/60 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> Subtask Progress
              </span>
              <span className="text-xs text-white/50">{subtaskCompletion.completed}/{subtaskCompletion.total} tasks ({subtaskCompletion.pct}%)</span>
            </div>
            <div className="w-full bg-white/15 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${subtaskCompletion.pct >= 100 ? "bg-emerald-500" : subtaskCompletion.pct > 50 ? "bg-blue-500" : subtaskCompletion.pct > 0 ? "bg-amber-500" : "bg-white/15"}`} style={{ width: `${Math.max(subtaskCompletion.pct, 1)}%` }} data-testid={`progress-subtask-${project.id}`} />
            </div>
          </div>
        )}
      </div>

      {project.status === "active" && planWeeks.length > 0 && (
        <div className="p-4 space-y-2" data-testid={`execution-tracking-${project.id}`}>
          <h5 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-500" /> Execution Tracking
          </h5>
          {planWeeks.map((week: any) => {
            const key = `detail-${project.id}-w${week.weekNumber}`;
            const isOpen = expandedWeeks[key];
            const logs = logsByWeek[week.weekNumber] || [];
            const deliverables = week.deliverables || [];
            const subtasksWithLogs = new Set<number>();
            logs.forEach((l: any) => { if (l.subtaskIndex !== null && l.subtaskIndex !== undefined) subtasksWithLogs.add(l.subtaskIndex); });
            const weekPct = deliverables.length > 0 ? Math.round((subtasksWithLogs.size / deliverables.length) * 100) : 0;

            return (
              <div key={key} className={`border rounded-lg transition-all ${isOpen ? "border-indigo-500/20 bg-indigo-500/10" : "border-white/[0.06]"}`}>
                <button className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.04] transition-colors rounded-lg" onClick={() => toggleWeek(key)} data-testid={`button-expand-week-${project.id}-${week.weekNumber}`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-indigo-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />}
                    <span className="text-sm font-medium text-white/90">W{week.weekNumber}: {week.milestone}</span>
                  </div>
                  <div className="flex items-center gap-3 ml-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 bg-white/15 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${weekPct >= 100 ? "bg-emerald-500" : weekPct > 0 ? "bg-blue-500" : "bg-white/15"}`} style={{ width: `${Math.max(weekPct, 3)}%` }} />
                      </div>
                      <span className="text-[11px] text-white/40 w-8">{weekPct}%</span>
                    </div>
                    <Badge className="bg-white/10 text-white/60 border-white/[0.08] text-[11px]">{logs.length} log{logs.length !== 1 ? "s" : ""}</Badge>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 border-t border-white/[0.06]">
                    <div className="pt-2 mb-2 flex items-center gap-4 text-xs text-white/40">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {week.hours}h planned</span>
                      <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {week.successCriteria}</span>
                    </div>

                    <div className="space-y-2">
                      {deliverables.map((deliverable: string, dIdx: number) => {
                        const subtaskLogs = logs.filter((l: any) => l.subtaskIndex === dIdx);
                        const hasLogs = subtaskLogs.length > 0;
                        const subtaskKey = `${key}-s${dIdx}`;
                        const isSubtaskOpen = expandedWeeks[subtaskKey];

                        return (
                          <div key={dIdx} className={`border rounded-lg transition-all ${isSubtaskOpen ? "border-indigo-500/20" : "border-white/[0.06]"}`} data-testid={`subtask-${project.id}-${week.weekNumber}-${dIdx}`}>
                            <button onClick={() => toggleWeek(subtaskKey)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.04] rounded-lg">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {hasLogs ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-white/[0.15] shrink-0" />}
                                <span className="text-sm text-white/70">{deliverable}</span>
                              </div>
                              <span className="text-xs text-white/40 ml-2">{subtaskLogs.length} log{subtaskLogs.length !== 1 ? "s" : ""}</span>
                            </button>
                            {isSubtaskOpen && subtaskLogs.length > 0 && (
                              <div className="px-3 pb-3 space-y-1.5">
                                {subtaskLogs.map((log: any) => {
                                  const commentsForLog = commentsByLogId[log.id] || [];
                                  const commentValue = logCommentInputs[log.id] || "";
                                  return (
                                    <div key={log.id} className="space-y-1">
                                      <div className="bg-background rounded-lg p-3 text-sm" data-testid={`log-entry-${log.id}`}>
                                        <p className="text-white/90 whitespace-pre-wrap" data-testid={`text-log-${log.id}`}>{log.logText}</p>
                                        <p className="text-white/40 text-xs mt-1" data-testid={`text-log-date-${log.id}`}>
                                          {log.dayNumber ? `Day ${log.dayNumber} · ` : ""}{formatLogDate(log.createdAt)}
                                        </p>
                                      </div>
                                      {commentsForLog.length > 0 && (
                                        <div className="ml-4 space-y-1">
                                          {commentsForLog.map((c: any) => (
                                            <div key={c.id} className="bg-blue-500/10 rounded px-3 py-1.5 text-xs" data-testid={`log-comment-${c.id}`}>
                                              <p className="text-blue-300">{c.content}</p>
                                              <p className="text-blue-400 mt-0.5">{formatLogDate(c.createdAt)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <div className="ml-4 flex gap-1 mt-1">
                                        <Input placeholder="Add feedback..." value={commentValue} onChange={(e) => setLogCommentInputs((prev) => ({ ...prev, [log.id]: e.target.value }))} className="text-xs h-7" data-testid={`input-log-comment-${log.id}`} />
                                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!commentValue.trim() || addLogCommentMutation.isPending} onClick={() => { if (!commentValue.trim()) return; addLogCommentMutation.mutate({ logId: log.id, content: commentValue.trim() }, { onSuccess: () => setLogCommentInputs((prev) => ({ ...prev, [log.id]: "" })) }); }} data-testid={`button-log-comment-${log.id}`}>
                                          Comment
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {isSubtaskOpen && subtaskLogs.length === 0 && (
                              <div className="px-3 pb-3">
                                <p className="text-xs text-white/40 flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" /> No logs yet for this task
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {(() => {
                      const generalLogs = logs.filter((l: any) => l.subtaskIndex === null || l.subtaskIndex === undefined);
                      if (generalLogs.length === 0) return null;
                      return (
                        <div className="mt-2 pt-2 border-t border-white/[0.06]">
                          <p className="text-xs font-medium text-white/50 mb-1.5">General Logs</p>
                          {generalLogs.map((log: any) => {
                            const commentsForLog = commentsByLogId[log.id] || [];
                            const commentValue = logCommentInputs[log.id] || "";
                            return (
                              <div key={log.id} className="space-y-1 mb-1.5">
                                <div className="bg-background rounded-lg p-3 text-sm" data-testid={`log-entry-${log.id}`}>
                                  <p className="text-white/90 whitespace-pre-wrap">{log.logText}</p>
                                  <p className="text-white/40 text-xs mt-1">{formatLogDate(log.createdAt)}</p>
                                </div>
                                {commentsForLog.length > 0 && commentsForLog.map((c: any) => (
                                  <div key={c.id} className="ml-4 bg-blue-500/10 rounded px-3 py-1.5 text-xs">
                                    <p className="text-blue-300">{c.content}</p>
                                    <p className="text-blue-400 mt-0.5">{formatLogDate(c.createdAt)}</p>
                                  </div>
                                ))}
                                <div className="ml-4 flex gap-1 mt-1">
                                  <Input placeholder="Add feedback..." value={commentValue} onChange={(e) => setLogCommentInputs((prev) => ({ ...prev, [log.id]: e.target.value }))} className="text-xs h-7" />
                                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!commentValue.trim() || addLogCommentMutation.isPending} onClick={() => { if (!commentValue.trim()) return; addLogCommentMutation.mutate({ logId: log.id, content: commentValue.trim() }, { onSuccess: () => setLogCommentInputs((prev) => ({ ...prev, [log.id]: "" })) }); }}>Comment</Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {project.status !== "active" && planWeeks.length > 0 && (
        <div className="p-4 space-y-2">
          <h5 className="text-sm font-semibold text-white/70 mb-2">Plan Overview</h5>
          {planWeeks.map((week: any) => {
            const key = `plan-${project.id}-w${week.weekNumber}`;
            const isOpen = expandedWeeks[key];
            return (
              <div key={key} className="border border-white/[0.06] rounded-lg">
                <button className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.04]" onClick={() => toggleWeek(key)} data-testid={`button-plan-week-${project.id}-${week.weekNumber}`}>
                  <span className="text-sm font-medium text-white/90">Week {week.weekNumber}: {week.milestone}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-1 text-sm text-white/60">
                    <p><span className="font-medium text-white/70">Hours:</span> {week.hours}h</p>
                    <p><span className="font-medium text-white/70">Success Criteria:</span> {week.successCriteria}</p>
                    <div>
                      <span className="font-medium text-white/70">Deliverables:</span>
                      <ul className="list-disc ml-5 mt-1">
                        {(week.deliverables || []).map((d: string, i: number) => (<li key={i}>{d}</li>))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {latestVersion && (
        <div className="p-4 border-t border-white/[0.06]" data-testid={`plan-comments-section-${project.id}`}>
          <h5 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" /> Plan Comments
          </h5>
          {planComments.length > 0 && (
            <div className="space-y-2 mb-3">
              {planComments.map((c: any) => (
                <div key={c.id} className="bg-blue-500/10 rounded-lg px-3 py-2 text-sm" data-testid={`plan-comment-${c.id}`}>
                  <p className="text-white/90">{c.content}</p>
                  <p className="text-white/40 text-xs mt-1">{formatLogDate(c.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Add feedback on this plan..."
              value={planComment}
              onChange={(e) => setPlanComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && planComment.trim()) { addPlanCommentMutation.mutate({ versionId: latestVersion.id, content: planComment.trim() }); } }}
              className="text-sm"
              data-testid={`input-plan-comment-${project.id}`}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!planComment.trim() || addPlanCommentMutation.isPending}
              onClick={() => { if (planComment.trim()) addPlanCommentMutation.mutate({ versionId: latestVersion.id, content: planComment.trim() }); }}
              data-testid={`button-plan-comment-${project.id}`}
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Comment
            </Button>
          </div>
        </div>
      )}

      <GitHubPanel
        projectId={project.id}
        githubRepoUrl={project.githubRepoUrl}
        isAdmin={true}
        companyId={project.companyId}
      />

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md" data-testid={`modal-edit-project-${project.id}`}>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} data-testid={`input-edit-title-${project.id}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Idea</label>
              <Textarea value={editIdea} onChange={(e) => setEditIdea(e.target.value)} rows={3} data-testid={`input-edit-idea-${project.id}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Minimum Total Hours</label>
              <Input type="number" min="1" value={editMinHours} onChange={(e) => setEditMinHours(e.target.value)} data-testid={`input-edit-hours-${project.id}`} />
            </div>
            <GitHubRepoInput value={editGithubUrl} onChange={setEditGithubUrl} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1" data-testid={`button-cancel-edit-${project.id}`}>Cancel</Button>
            <Button onClick={() => editProjectMutation.mutate()} disabled={!editTitle.trim() || !editIdea.trim() || !editMinHours || editProjectMutation.isPending} className="flex-1 bg-[#6D5EF5] hover:bg-[#5142D6] text-white" data-testid={`button-save-edit-${project.id}`}>
              {editProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid={`modal-delete-project-${project.id}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-white/80">"{project.title}"</span>? All plans, logs, and comments will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-delete-${project.id}`}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteProjectMutation.mutate()} disabled={deleteProjectMutation.isPending} className="bg-red-600 hover:bg-red-600/90 text-white" data-testid={`button-confirm-delete-${project.id}`}>
              {deleteProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Real-data task overview: attention required, due today, and recent
// activity. Activity entries are derived only from timestamps that already
// exist on each task (createdAt/submittedAt/completedAt/updatedAt) — nothing
// here is synthesized or fabricated.
function TaskOverviewSection({ interns }: { interns: any[] }) {
  const { data: tasks = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/tasks"], refetchInterval: 15000 });

  if (isLoading) return null;

  const internName = (id: string) => interns.find((i: any) => i.id === id)?.name || "Unknown";

  const now = Date.now();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

  const dueToday = tasks.filter((t: any) => t.dueDate && t.status !== "completed" && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) <= endOfToday);

  type ActivityItem = { taskId: string; title: string; intern: string; event: string; ts: string };
  const activity: ActivityItem[] = [];
  tasks.forEach((t: any) => {
    activity.push({ taskId: t.id, title: t.title, intern: internName(t.assigneeId), event: "assigned", ts: t.createdAt });
    if (t.submittedAt) activity.push({ taskId: t.id, title: t.title, intern: internName(t.assigneeId), event: "submitted for review", ts: t.submittedAt });
    if (t.completedAt) activity.push({ taskId: t.id, title: t.title, intern: internName(t.assigneeId), event: "completed", ts: t.completedAt });
    if (t.status === "blocked") activity.push({ taskId: t.id, title: t.title, intern: internName(t.assigneeId), event: "blocked", ts: t.updatedAt });
  });
  activity.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const recentActivity = activity.slice(0, 8);

  if (tasks.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-6 text-center" data-testid="section-task-overview-empty">
        <ListTodo className="w-8 h-8 text-white/30 mx-auto mb-2" />
        <p className="text-white/50 font-medium">No tasks yet</p>
        <p className="text-sm text-white/40 mt-1">
          <Link href="/tasks" className="text-blue-400 hover:underline">Create your first task</Link> to start tracking real work.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="section-task-overview">
      <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-5">
        <h3 className="font-semibold text-white flex items-center gap-1.5 mb-3"><Clock className="w-4 h-4 text-blue-400" />Due Today</h3>
        {dueToday.length === 0 ? (
          <p className="text-sm text-white/40">Nothing due today.</p>
        ) : (
          <div className="space-y-1.5">
            {dueToday.map((t: any) => (
              <Link key={t.id} href="/tasks" className="block text-sm p-2 rounded-lg hover:bg-white/[0.04] no-underline" data-testid={`activity-due-today-${t.id}`}>
                <span className="text-white/70">{t.title}</span>
                <span className="text-white/40"> — {internName(t.assigneeId)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-5">
        <h3 className="font-semibold text-white flex items-center gap-1.5 mb-3"><Clock className="w-4 h-4 text-white/50" />Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-white/40">No activity yet.</p>
        ) : (
          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {recentActivity.map((a, i) => (
              <div key={i} className="text-sm" data-testid={`activity-item-${i}`}>
                <span className="text-white/70">{a.intern}</span>
                <span className="text-white/40"> {a.event} </span>
                <span className="text-white font-medium">"{a.title}"</span>
                <p className="text-xs text-white/40">{formatRelativeTime(a.ts)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Reads the same cached /api/tasks query TaskOverviewSection already
// fetches (react-query dedupes by key), so this costs no extra request.
function TaskCompletionBadge({ internId }: { internId: string }) {
  const { data: tasks = [] } = useQuery<any[]>({ queryKey: ["/api/tasks"], refetchInterval: 15000 });
  const mine = tasks.filter((t: any) => t.assigneeId === internId);
  if (mine.length === 0) return null;
  const completed = mine.filter((t: any) => t.status === "completed").length;
  const blocked = mine.filter((t: any) => t.status === "blocked").length;
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium ${blocked > 0 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-background text-white/60 border-white/[0.08]"}`}
      data-testid={`badge-task-completion-${internId}`}
    >
      {completed}/{mine.length} tasks{blocked > 0 ? ` · ${blocked} blocked` : ""}
    </Badge>
  );
}

function ManagersSection({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: managers = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/managers"] });
  const [confirmDemote, setConfirmDemote] = useState<{ id: string; name: string } | null>(null);

  const demoteMutation = useMutation({
    mutationFn: async (managerId: string) => {
      const res = await apiRequest("POST", `/api/managers/${managerId}/demote`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interns"] });
      toast({ title: "Moved to intern", description: `${data.name} no longer has manager access.` });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  if (isLoading || managers.length === 0) return null;

  return (
    <div data-testid="managers-section">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <ShieldPlus className="w-5 h-5 text-white/60" />Admins
      </h2>
      <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm divide-y divide-white/[0.06]">
        {managers.map((manager: any) => {
          const isSelf = manager.id === currentUserId;
          return (
            <div key={manager.id} className="p-4 flex items-center justify-between gap-3" data-testid={`row-manager-${manager.id}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">{manager.name}</p>
                  {isSelf && <Badge variant="outline" className="bg-white/10 text-white/50 border-white/[0.08] text-xs">You</Badge>}
                </div>
                <p className="text-xs text-white/50 truncate">{manager.email}</p>
              </div>
              {!isSelf && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-red-400 border-red-500/20 hover:bg-red-500/10 shrink-0"
                  onClick={() => setConfirmDemote({ id: manager.id, name: manager.name })}
                  disabled={demoteMutation.isPending}
                  data-testid={`button-demote-manager-${manager.id}`}
                >
                  {demoteMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                  Demote to Intern
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirmDemote} onOpenChange={(open) => { if (!open) setConfirmDemote(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Demote {confirmDemote?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They'll lose admin access immediately and go back to the intern dashboard.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-600/90 text-white"
              onClick={() => { if (confirmDemote) demoteMutation.mutate(confirmDemote.id); setConfirmDemote(null); }}
            >
              Demote to Intern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface RelatedTasks {
  blockedTaskIds?: string[];
  overdueTaskIds?: string[];
  inReviewTaskIds?: string[];
}

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  aiGenerated?: boolean;
  related?: RelatedTasks;
}

// Small clickable chips ("3 overdue", "2 blocked") beneath an AI response,
// routing to the matching pre-filtered Tasks view — turns the answer into
// something actionable instead of a plain text bubble.
function RelatedTaskChips({ related, onNavigate }: { related?: RelatedTasks; onNavigate: (status: string) => void }) {
  if (!related) return null;
  const chips: { label: string; status: string; count: number }[] = [
    { label: "overdue", status: "overdue", count: related.overdueTaskIds?.length || 0 },
    { label: "blocked", status: "blocked", count: related.blockedTaskIds?.length || 0 },
    { label: "in review", status: "in_review", count: related.inReviewTaskIds?.length || 0 },
  ].filter((c) => c.count > 0);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {chips.map((c) => (
        <button
          key={c.status}
          onClick={() => onNavigate(c.status)}
          className="text-xs px-2.5 py-1 rounded-full border border-white/[0.1] text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
          data-testid={`chip-related-${c.status}`}
        >
          {c.count} {c.label}
        </button>
      ))}
    </div>
  );
}

const SUGGESTED_PROMPTS = [
  "Give me a briefing",
  "What's blocked right now?",
  "Who's falling behind?",
];

interface SignalAction {
  label: string;
  kind: "view_task" | "view_project" | "view_intern" | "message" | "review";
  taskId?: string;
  projectId?: string;
  userId?: string;
}

interface Signal {
  key: string;
  type: "deadline_risk" | "possible_blocker" | "pending_review" | "workflow_stalled" | "project_at_risk" | "no_work_assigned" | "overloaded" | "inactive" | "unusual_hours" | "pending_proposal";
  severity: "high" | "medium";
  headline: string;
  description: string;
  internId?: string;
  taskId?: string;
  projectId?: string;
  actions: SignalAction[];
}

// Manager Signals: "what actually needs my attention right now?" — every
// row is a real, explainable workflow condition (see server/services/
// signals.ts), never a productivity score. Dismiss/snooze use the same
// backend mechanism with different cooldowns, so an unresolved problem
// naturally resurfaces instead of being silenced forever.
function SignalsPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: signals = [], isLoading } = useQuery<Signal[]>({ queryKey: ["/api/signals"], refetchInterval: 20000 });

  const dismissMutation = useMutation({
    mutationFn: async (key: string) => {
      await apiRequest("POST", "/api/signals/dismiss", { key });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/signals"] }),
    onError: (err: any) => toast({ title: "Couldn't dismiss signal", description: err.message, variant: "destructive" }),
  });

  const snoozeMutation = useMutation({
    mutationFn: async (key: string) => {
      await apiRequest("POST", "/api/signals/snooze", { key, days: 7 });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/signals"] }),
    onError: (err: any) => toast({ title: "Couldn't snooze signal", description: err.message, variant: "destructive" }),
  });

  const runAction = (action: SignalAction) => {
    if (action.kind === "view_task" && action.taskId) setLocation(`/?view=tasks&taskId=${action.taskId}`);
    else if (action.kind === "review" && action.taskId) setLocation(`/?view=tasks&taskId=${action.taskId}`);
    else if (action.kind === "view_project" && action.projectId) setLocation(`/?projectId=${action.projectId}`);
    else if (action.kind === "message" && action.userId) setLocation(`/chat?userId=${action.userId}`);
    else if (action.kind === "view_intern" && action.userId) setLocation(`/interns/${action.userId}`);
  };

  if (isLoading || signals.length === 0) return null;

  const severityColor = (s: Signal["severity"]) => (s === "high" ? "text-red-400 bg-red-500/10" : "text-amber-400 bg-amber-500/10");

  return (
    <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-5" data-testid="section-signals">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          <h3 className="font-heading font-semibold text-white leading-tight">Manager Signals</h3>
          <p className="text-[11px] text-white/40 leading-tight">What actually needs your attention right now</p>
        </div>
      </div>
      <div className="space-y-2">
        {signals.map((signal) => (
          <div key={signal.key} className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]" data-testid={`row-signal-${signal.key}`}>
            <div className="flex items-start justify-between gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${severityColor(signal.severity)}`}>
                {signal.headline}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => snoozeMutation.mutate(signal.key)}
                  className="text-[10px] text-white/40 hover:text-white/70 px-1.5 py-0.5 transition-colors"
                  data-testid={`button-snooze-${signal.key}`}
                >
                  Snooze
                </button>
                <button
                  onClick={() => dismissMutation.mutate(signal.key)}
                  className="text-[10px] text-white/40 hover:text-white/70 px-1.5 py-0.5 transition-colors"
                  data-testid={`button-dismiss-${signal.key}`}
                >
                  Dismiss
                </button>
              </div>
            </div>
            <p className="text-sm text-white/80 mt-1.5">{signal.description}</p>
            {signal.actions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {signal.actions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => runAction(action)}
                    className="text-xs px-2.5 py-1 rounded-full border border-white/[0.1] text-white/60 hover:bg-white/[0.06] transition-colors"
                    data-testid={`button-signal-action-${signal.key}-${i}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrgAssistantPanel() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const nextMessages = [...messages, { role: "user" as const, content: question }];
      setMessages(nextMessages);
      const res = await apiRequest("POST", "/api/ai/org-assistant", {
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, aiGenerated: data.aiGenerated, related: data.related }]);
    },
    onError: (err: any) => {
      toast({ title: "Pulse is unavailable", description: err.message, variant: "destructive" });
    },
  });

  const ask = (question: string) => {
    if (!question.trim() || askMutation.isPending) return;
    setInput("");
    askMutation.mutate(question.trim());
  };

  return (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-br from-[#6D5EF5]/40 via-[#8B7FF7]/20 to-transparent" data-testid="section-org-assistant">
      <div className="bg-card rounded-[11px] p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-lg bg-surface-accent flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5 text-[#8B7FF7]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-white leading-tight">Pulse</h3>
            <p className="text-[11px] text-white/40 leading-tight">AI insights for your org</p>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="mb-3">
            <p className="text-sm text-white/50 mb-3">Ask about blockers, who's behind, or get a quick briefing — answered from your real task data.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => ask(p)}
                  className="text-xs px-3 py-1.5 rounded-full border border-white/[0.08] text-white/60 hover:bg-white/[0.04] transition-colors"
                  data-testid={`button-suggested-prompt-${p.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-3 max-h-96 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "text-right" : ""}`} data-testid={`assistant-message-${i}`}>
                <div className={`inline-block max-w-[90%] rounded-lg px-3 py-2 whitespace-pre-wrap text-left ${m.role === "user" ? "bg-surface-accent text-white" : "bg-background text-white/90 border border-white/[0.06]"}`}>
                  {m.content}
                </div>
                {m.role === "assistant" && (
                  <RelatedTaskChips related={m.related} onNavigate={(status) => setLocation(`/tasks?status=${status}`)} />
                )}
              </div>
            ))}
            {askMutation.isPending && (
              <div className="text-sm">
                <div className="inline-flex items-center gap-1.5 bg-background border border-white/[0.06] rounded-lg px-3 py-2 text-white/40">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pulse is thinking...
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
            placeholder="Ask Pulse about your team..."
            className="flex-1 focus-visible:ring-[#6D5EF5]/50"
            data-testid="input-org-assistant"
          />
          <Button size="sm" onClick={() => ask(input)} disabled={!input.trim() || askMutation.isPending} className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white" data-testid="button-ask-assistant">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPlanReview, setShowPlanReview] = useState(false);
  const [confirmState, setConfirmState] = useState<{ title: string; description: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const [deleteInternTarget, setDeleteInternTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteInternTyped, setDeleteInternTyped] = useState("");
  const [expandedIntern, setExpandedIntern] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [createdIntern, setCreatedIntern] = useState<{ name: string; email: string; password: string } | null>(null);
  const [assignInternId, setAssignInternId] = useState("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignIdea, setAssignIdea] = useState("");
  const [assignMinHours, setAssignMinHours] = useState("");
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const internOverviewRef = useRef<HTMLDivElement>(null);

  const { data: dashboard, isLoading } = useQuery<any>({ queryKey: ["/api/dashboard"], refetchInterval: 20000 });
  const { data: interns = [] } = useQuery<any[]>({ queryKey: ["/api/interns"] });
  const { data: analytics } = useQuery<any>({ queryKey: ["/api/analytics/admin"] });
  const { data: taskListForSearch = [] } = useQuery<any[]>({ queryKey: ["/api/tasks"], refetchInterval: 15000 });
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    if (isLoading || !dashboard) return;
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const projectId = params.get("projectId");
    const assignProjectFor = params.get("assignProject");
    let handled = false;

    if (view === "review") {
      setShowPlanReview(true);
      handled = true;
    }

    // Deep-linked from the Worktime "no work assigned" quick action.
    if (assignProjectFor) {
      setAssignInternId(assignProjectFor);
      setShowAssignModal(true);
      handled = true;
    }
    if (view === "interns") {
      setTimeout(() => {
        internOverviewRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      handled = true;
    }

    if (projectId) {
      const allInterns = dashboard?.interns || [];
      const matchedIntern = allInterns.find((intern: any) =>
        (intern.projects || []).some((p: any) => p.id === projectId)
      );
      if (matchedIntern) {
        setExpandedIntern(matchedIntern.id);
        setTimeout(() => {
          internOverviewRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
      handled = true;
    }

    if (handled) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [isLoading, dashboard]);

  const inviteMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/interns", { name: inviteName, email: inviteEmail, password: invitePassword }); return res.json(); },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interns"] });
      setCreatedIntern({ name: data.name, email: data.email, password: invitePassword });
      toast({ title: "Intern account created", description: `${data.name} can log in immediately.` });
      setInviteName(""); setInviteEmail(""); setInvitePassword("");
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const assignProjectMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/projects", { internId: assignInternId, title: assignTitle, idea: assignIdea, minimumTotalHours: Number(assignMinHours) }); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Project assigned successfully!" });
      setAssignInternId(""); setAssignTitle(""); setAssignIdea(""); setAssignMinHours("");
      setShowAssignModal(false);
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const deleteAllProjectsMutation = useMutation({
    mutationFn: async (internId: string) => { const res = await apiRequest("DELETE", `/api/projects/intern/${internId}`); return res.json(); },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Projects deleted", description: data.message });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const deactivateInternMutation = useMutation({
    mutationFn: async ({ internId, deactivate }: { internId: string; deactivate: boolean }) => {
      const res = await apiRequest("POST", `/api/interns/${internId}/${deactivate ? "deactivate" : "reactivate"}`);
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interns"] });
      toast({ title: variables.deactivate ? "Intern deactivated" : "Intern reactivated", description: `${data.name} ${variables.deactivate ? "can no longer log in." : "can log in again."}` });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const deleteInternMutation = useMutation({
    mutationFn: async (internId: string) => {
      const res = await apiRequest("DELETE", `/api/interns/${internId}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Intern deleted", description: data.message });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const promoteInternMutation = useMutation({
    mutationFn: async (internId: string) => {
      const res = await apiRequest("POST", `/api/interns/${internId}/promote`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interns"] });
      toast({ title: "Promoted to admin", description: `${data.name} now has full admin access.` });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ versionId, comment }: { versionId: string; comment?: string }) => { const res = await apiRequest("POST", `/api/plan-versions/${versionId}/approve`, { comment: comment || undefined }); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }); toast({ title: "Plan approved!" }); },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const requestRevisionMutation = useMutation({
    mutationFn: async ({ versionId, comment }: { versionId: string; comment: string }) => { const res = await apiRequest("POST", `/api/plan-versions/${versionId}/request-revision`, { comment }); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }); toast({ title: "Revision requested" }); },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ versionId, content }: { versionId: string; content: string }) => { const res = await apiRequest("POST", `/api/plan-versions/${versionId}/comments`, { content }); return res.json(); },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plan-versions", variables.versionId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Comment added" });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const allDashboardInterns = dashboard?.interns || [];
  const company = dashboard?.company;
  const totalProjects = dashboard?.totalProjects || 0;
  const activeProjects = dashboard?.activeProjects || 0;
  const pendingReview = dashboard?.pendingReview || 0;

  const filteredInterns = (() => {
    let result = allDashboardInterns;
    if (filter === "active") result = result.filter((intern: any) => (intern.projects || []).some((p: any) => p.status === "active"));
    if (filter === "review") result = result.filter((intern: any) => (intern.projects || []).some((p: any) => p.status === "submitted"));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((intern: any) =>
        intern.name.toLowerCase().includes(q) ||
        intern.email.toLowerCase().includes(q) ||
        (intern.projects || []).some((p: any) => p.title?.toLowerCase().includes(q) || p.idea?.toLowerCase().includes(q))
      );
    }
    return result;
  })();

  const pagination = usePaginatedList({ items: filteredInterns, pageSize: 10 });

  const commandItems = useAdminCommands({
    onInvite: () => setShowInviteModal(true),
    onAssign: () => setShowAssignModal(true),
    onReview: () => setShowPlanReview(true),
    onSignOut: () => {},
    onNavigateHome: () => { setFilter(null); setSearchQuery(""); },
    onNavigate: (path) => setLocation(path),
    interns: allDashboardInterns.map((i: any) => ({ id: i.id, name: i.name, email: i.email })),
    tasks: taskListForSearch,
    projects: allDashboardInterns.flatMap((i: any) => (i.projects || []).map((p: any) => ({ id: p.id, title: p.title, status: p.status, internName: i.name }))),
  });

  useKeyboardShortcuts([
    { key: "k", meta: true, handler: () => setCommandPaletteOpen(true), description: "Open command palette" },
    { key: "i", meta: true, shift: true, handler: () => setShowInviteModal(true), description: "Invite intern" },
  ]);

  useEffect(() => {
    const handler = () => setCommandPaletteOpen(true);
    window.addEventListener("open-command-palette", handler);
    return () => window.removeEventListener("open-command-palette", handler);
  }, []);

  if (isLoading) {
    return <AdminDashboardSkeleton />;
  }

  const submittedProjects: any[] = [];
  allDashboardInterns.forEach((intern: any) => {
    (intern.projects || []).forEach((project: any) => {
      if (project.status === "submitted") {
        submittedProjects.push({ ...project, internName: intern.name, internEmail: intern.email });
      }
    });
  });

  function copyLink(link: string) { navigator.clipboard.writeText(link).catch(() => {}); toast({ title: "Link copied!" }); }

  function handleAssignProject() {
    const hours = Number(assignMinHours);
    if (!hours || hours <= 0) { toast({ title: "Validation Error", description: "Minimum total hours must be greater than 0.", variant: "destructive" }); return; }
    assignProjectMutation.mutate();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-6" data-testid="header-section">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white" data-testid="text-company-name">{company?.name || "Company"}</h1>
              <p className="text-white/50 text-sm mt-1" data-testid="text-dashboard-title">Admin Dashboard</p>
            </div>
            <div className="flex items-center flex-wrap gap-3">
              <Button onClick={() => setShowInviteModal(true)} className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white" data-testid="button-open-invite">
                <UserPlus className="w-4 h-4 mr-2" />Add Intern
              </Button>
              <Button onClick={() => setShowAssignModal(true)} variant="outline" className="border-white/[0.15] text-white/70 hover:bg-white/[0.04]" data-testid="button-open-assign">
                <Briefcase className="w-4 h-4 mr-2" />Assign Project
              </Button>
              <Button
                onClick={() => {
                  exportTeamReport({
                    companyName: company?.name || "Company",
                    interns: allDashboardInterns,
                    completionRates: analytics?.completionRates || [],
                    taskCompletionByIntern: analytics?.taskCompletionByIntern || [],
                    hoursComparison: analytics?.hoursComparison || [],
                  });
                  toast({ title: "Report exported", description: "Your team report CSV has been downloaded." });
                }}
                variant="outline"
                className="border-white/[0.15] text-white/70 hover:bg-white/[0.04]"
                data-testid="button-export-report"
              >
                <Download className="w-4 h-4 mr-2" />Export Report
              </Button>
              <GitHubTokenSettings companyId={user.companyId || ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => { setFilter(filter === "interns" ? null : "interns"); }} className={`text-left rounded-lg p-4 border transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${filter === "interns" ? "bg-blue-500/10 border-blue-300 ring-2 ring-blue-200" : "bg-background border-white/[0.06] hover:border-blue-500/20"}`} data-testid="stat-total-interns">
              <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-blue-400" /><span className="text-label text-white/50">Interns</span></div>
              <p className="text-metric text-3xl text-white">{allDashboardInterns.length}</p>
            </button>
            <button onClick={() => { setFilter(filter === "projects" ? null : "projects"); }} className={`text-left rounded-lg p-4 border transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${filter === "projects" ? "bg-indigo-500/10 border-indigo-300 ring-2 ring-indigo-200" : "bg-background border-white/[0.06] hover:border-indigo-500/20"}`} data-testid="stat-total-projects">
              <div className="flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 text-indigo-400" /><span className="text-label text-white/50">Projects</span></div>
              <p className="text-metric text-3xl text-white">{totalProjects}</p>
            </button>
            <button onClick={() => { setFilter(filter === "active" ? null : "active"); }} className={`text-left rounded-lg p-4 border transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${filter === "active" ? "bg-emerald-500/10 border-emerald-300 ring-2 ring-emerald-200" : "bg-background border-white/[0.06] hover:border-emerald-500/20"}`} data-testid="stat-active-projects">
              <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-label text-white/50">Active</span></div>
              <p className="text-metric text-3xl text-white">{activeProjects}</p>
            </button>
            <button onClick={() => { const newFilter = filter === "review" ? null : "review"; setFilter(newFilter); if (newFilter === "review") setShowPlanReview(true); }} className={`text-left rounded-lg p-4 border transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${filter === "review" ? "bg-amber-500/10 border-amber-300 ring-2 ring-amber-200" : "bg-background border-white/[0.06] hover:border-amber-500/20"}`} data-testid="stat-pending-review">
              <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-400" /><span className="text-label text-white/50">Pending Review</span></div>
              <p className="text-metric text-3xl text-white">{pendingReview}</p>
            </button>
          </div>
          {filter && (
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-3 py-1 text-sm flex items-center gap-1.5" data-testid="badge-active-filter">
                <Filter className="w-3 h-3" />
                Filtering: {filter === "interns" ? "All Interns" : filter === "projects" ? "All Projects" : filter === "active" ? "Active Projects" : "Pending Review"}
              </Badge>
              <button onClick={() => { setFilter(null); }} className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10 transition-colors" data-testid="button-clear-filter">
                <X className="w-3 h-3" /> Clear filter
              </button>
            </div>
          )}
        </div>

        <PulseScoreCard
          completionRates={analytics?.completionRates || []}
          taskCompletionByIntern={analytics?.taskCompletionByIntern || []}
          activeProjects={activeProjects}
          totalProjects={totalProjects}
          pendingReview={pendingReview}
        />

        <TaskOverviewSection interns={allDashboardInterns} />

        <SignalsPanel />

        <OrgAssistantPanel />

        {submittedProjects.length > 0 && (
          <div className="space-y-4" data-testid="plan-review-panel">
            <h2 className="text-xl font-bold text-white flex items-center gap-2" data-testid="text-review-header">
              <AlertCircle className="w-5 h-5 text-amber-400" /> Review Now
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs font-medium ml-1">{submittedProjects.length}</Badge>
            </h2>
            {submittedProjects.map((project: any) => {
              const versions = project.versions || [];
              const submittedVersion = versions.find((v: any) => v.status === "submitted");
              if (!submittedVersion) return null;
              const content = submittedVersion.contentJson || {};
              const weeks = content.weeks || [];
              const versionComment = reviewComments[submittedVersion.id] || "";
              return (
                <PlanReviewCard
                  key={project.id} project={project} version={submittedVersion} content={content} weeks={weeks}
                  comment={versionComment} onCommentChange={(val: string) => setReviewComments((prev) => ({ ...prev, [submittedVersion.id]: val }))}
                  expandedWeeks={expandedWeeks} onToggleWeek={(key: string) => setExpandedWeeks((prev) => ({ ...prev, [key]: !prev[key] }))}
                  onApprove={() => { approveMutation.mutate({ versionId: submittedVersion.id, comment: versionComment || undefined }); setReviewComments((prev) => ({ ...prev, [submittedVersion.id]: "" })); }}
                  onRequestRevision={() => { if (!versionComment.trim()) { toast({ title: "Comment required", description: "Please add a comment when requesting revision.", variant: "destructive" }); return; } requestRevisionMutation.mutate({ versionId: submittedVersion.id, comment: versionComment }); setReviewComments((prev) => ({ ...prev, [submittedVersion.id]: "" })); }}
                  onAddComment={() => { if (!versionComment.trim()) return; addCommentMutation.mutate({ versionId: submittedVersion.id, content: versionComment }); setReviewComments((prev) => ({ ...prev, [submittedVersion.id]: "" })); }}
                  isApproving={approveMutation.isPending} isRequestingRevision={requestRevisionMutation.isPending}
                />
              );
            })}
          </div>
        )}

        {analytics && (
          <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-5" data-testid="analytics-section">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">Analytics</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="analytics-charts-primary">
              <WeeklyActivityLineChart data={analytics.logActivity || []} />
              <TaskCompletionByInternChart data={analytics.taskCompletionByIntern || []} />
              <ProjectStatusPieChart data={analytics.statusCounts || []} />
            </div>
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/70 mt-4 pt-3 border-t border-white/[0.06] transition-colors"
              data-testid="button-toggle-analytics"
            >
              {showAnalytics ? "Show fewer charts" : "See more charts"}
              {showAnalytics ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {showAnalytics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4" data-testid="analytics-charts-secondary">
                <TaskStatusPieChart data={analytics.taskStatusCounts || []} />
                <CompletionRateBarChart data={analytics.completionRates || []} />
                <HoursComparisonChart data={analytics.hoursComparison || []} />
              </div>
            )}
          </div>
        )}

        <ApplicationsPanel companyId={user.companyId} />

        <ProjectProposalsPanel />

        <ManagersSection currentUserId={user.id} />

        <div ref={internOverviewRef} data-testid="intern-overview-section">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-white/60" />Intern Overview
          </h2>

          {allDashboardInterns.length > 0 && (
            <SearchFilterBar
              placeholder="Search interns, projects..."
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              filterOptions={[
                { value: "active", label: "Active", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                { value: "review", label: "Pending Review", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
              ]}
              activeFilter={filter}
              onFilterChange={setFilter}
              resultCount={filteredInterns.length}
            />
          )}

          {filteredInterns.length === 0 ? (
            <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-12 text-center" data-testid="text-no-interns">
              <Users className="w-12 h-12 text-white/30 mx-auto mb-3" />
              {searchQuery || filter ? (
                <>
                  <p className="text-white/50 text-lg mb-1">No matching results</p>
                  <p className="text-white/40 text-sm mb-3">Try adjusting your search or filters.</p>
                  <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setFilter(null); }}>Clear filters</Button>
                </>
              ) : (
                <>
                  <p className="text-white/50 text-lg mb-1">No interns yet</p>
                  <p className="text-white/40 text-sm mb-3">Add your first intern to get started.</p>
                  <Button onClick={() => setShowInviteModal(true)} className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white">
                    <UserPlus className="w-4 h-4 mr-2" />Add Intern
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {pagination.pageItems.map((intern: any) => {
                const isExpanded = expandedIntern === intern.id;
                const projects = intern.projects || [];
                const allPlanWeeks = projects.flatMap((p: any) => {
                  const v = (p.versions || []).find((v: any) => v.status === "approved") || (p.versions || []).sort((a: any, b: any) => b.versionNumber - a.versionNumber)[0];
                  return v?.contentJson?.weeks || [];
                });
                const allLogs = projects.flatMap((p: any) => p.weeklyLogs || []);
                const overallCompletion = getSubtaskCompletion(allPlanWeeks, allLogs);

                return (
                  <div key={intern.id} data-testid={`card-intern-${intern.id}`}>
                    <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer" onClick={() => setExpandedIntern(isExpanded ? null : intern.id)}>
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                href={`/interns/${intern.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-white font-semibold hover:text-[#6D5EF5] hover:underline no-underline"
                                data-testid={`text-intern-name-${intern.id}`}
                              >
                                {intern.name}
                              </Link>
                              <Link href={`/tasks?assigneeId=${intern.id}`} onClick={(e) => e.stopPropagation()}>
                                <TaskCompletionBadge internId={intern.id} />
                              </Link>
                              {intern.deactivatedAt && (
                                <Badge variant="outline" className="bg-white/10 text-white/50 border-white/[0.08] text-xs" data-testid={`badge-deactivated-${intern.id}`}>
                                  Deactivated
                                </Badge>
                              )}
                            </div>
                            <p className="text-white/50 text-sm" data-testid={`text-intern-email-${intern.id}`}>{intern.email}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {projects.length === 0 ? (
                              <span className="text-white/40 text-sm">No projects</span>
                            ) : (
                              <>
                                {projects.map((project: any) => (
                                  <div key={project.id} className="flex items-center gap-2 text-sm">
                                    <span className="text-white/70 font-medium truncate max-w-[200px]" data-testid={`text-project-title-${project.id}`}>{project.title}</span>
                                    {statusBadge(project.status)}
                                  </div>
                                ))}
                                {overallCompletion.total > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-20 bg-white/15 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full transition-all ${overallCompletion.pct >= 100 ? "bg-emerald-500" : overallCompletion.pct > 50 ? "bg-blue-500" : overallCompletion.pct > 0 ? "bg-amber-500" : "bg-white/15"}`} style={{ width: `${Math.max(overallCompletion.pct, 3)}%` }} />
                                    </div>
                                    <span className="text-xs text-white/40">{overallCompletion.pct}%</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <div>{isExpanded ? <ChevronDown className="w-5 h-5 text-white/40" /> : <ChevronRight className="w-5 h-5 text-white/40" />}</div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 space-y-3" data-testid={`expanded-intern-${intern.id}`}>
                        <div className="flex justify-end px-1 gap-2">
                          {!intern.deactivatedAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10"
                              onClick={(e) => { e.stopPropagation(); setConfirmState({ title: `Promote ${intern.name} to admin?`, description: "They'll get full admin access — all interns, tasks, and settings. This can't be undone from here.", confirmLabel: "Promote to Admin", onConfirm: () => promoteInternMutation.mutate(intern.id) }); }}
                              disabled={promoteInternMutation.isPending}
                              data-testid={`button-promote-intern-${intern.id}`}
                            >
                              {promoteInternMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ShieldPlus className="w-3 h-3 mr-1" />}
                              Promote to Admin
                            </Button>
                          )}
                          {intern.deactivatedAt ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                              onClick={(e) => { e.stopPropagation(); deactivateInternMutation.mutate({ internId: intern.id, deactivate: false }); }}
                              disabled={deactivateInternMutation.isPending}
                              data-testid={`button-reactivate-intern-${intern.id}`}
                            >
                              {deactivateInternMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-white/60 border-white/[0.15] hover:bg-white/[0.04]"
                              onClick={(e) => { e.stopPropagation(); setConfirmState({ title: `Deactivate ${intern.name}?`, description: "They won't be able to log in, but their tasks and history stay intact. You can reactivate them anytime.", confirmLabel: "Deactivate", onConfirm: () => deactivateInternMutation.mutate({ internId: intern.id, deactivate: true }) }); }}
                              disabled={deactivateInternMutation.isPending}
                              data-testid={`button-deactivate-intern-${intern.id}`}
                            >
                              {deactivateInternMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                              Deactivate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                            onClick={(e) => { e.stopPropagation(); setDeleteInternTarget({ id: intern.id, name: intern.name }); setDeleteInternTyped(""); }}
                            disabled={deleteInternMutation.isPending}
                            data-testid={`button-delete-intern-${intern.id}`}
                          >
                            {deleteInternMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                            Delete Permanently
                          </Button>
                        </div>
                        {projects.length > 1 && (
                          <div className="flex justify-end px-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-red-400 border-red-500/20 hover:bg-red-500/10"
                              onClick={(e) => { e.stopPropagation(); setConfirmState({ title: `Delete all ${projects.length} projects for ${intern.name}?`, description: "This cannot be undone.", confirmLabel: "Delete All Projects", onConfirm: () => deleteAllProjectsMutation.mutate(intern.id) }); }}
                              disabled={deleteAllProjectsMutation.isPending}
                              data-testid={`button-delete-all-projects-${intern.id}`}
                            >
                              {deleteAllProjectsMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                              Delete All Projects
                            </Button>
                          </div>
                        )}
                        {projects.length === 0 ? (
                          <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-8 text-center">
                            <Briefcase className="w-8 h-8 text-white/30 mx-auto mb-2" />
                            <p className="text-white/40 text-sm">No projects assigned yet</p>
                          </div>
                        ) : (
                          projects.map((project: any) => (<InternProjectDetail key={project.id} project={project} />))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-xs text-white/40">
                    Showing {(pagination.page - 1) * 10 + 1}-{Math.min(pagination.page * 10, pagination.totalItems)} of {pagination.totalItems}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={pagination.prevPage} disabled={!pagination.hasPrev} className="h-7 text-xs px-2">
                      Prev
                    </Button>
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                      <Button
                        key={p}
                        variant={p === pagination.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => pagination.setPage(p)}
                        className={`h-7 w-7 text-xs p-0 ${p === pagination.page ? "bg-[#6D5EF5] text-white" : ""}`}
                      >
                        {p}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={pagination.nextPage} disabled={!pagination.hasNext} className="h-7 text-xs px-2">
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        items={commandItems}
      />

      <Dialog open={showInviteModal} onOpenChange={(open) => { setShowInviteModal(open); if (!open) setCreatedIntern(null); }}>
        <DialogContent className="max-w-md" data-testid="modal-invite">
          <DialogHeader>
            <DialogTitle>Add Intern</DialogTitle>
          </DialogHeader>
          {createdIntern ? (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4" data-testid="invite-link-display">
                <p className="text-emerald-400 text-sm font-medium mb-3">Account created — {createdIntern.name} can log in right now.</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2 bg-background border border-emerald-500/20 rounded px-3 py-2">
                    <span className="text-white/50">Email</span>
                    <span className="text-white font-medium" data-testid="text-created-intern-email">{createdIntern.email}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-background border border-emerald-500/20 rounded px-3 py-2">
                    <span className="text-white/50">Password</span>
                    <span className="text-white font-medium" data-testid="text-created-intern-password">{createdIntern.password}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => copyLink(`Email: ${createdIntern.email}\nPassword: ${createdIntern.password}`)}
                  data-testid="button-copy-link"
                >
                  <Copy className="w-3 h-3 mr-1.5" /> Copy credentials
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setCreatedIntern(null)}
                data-testid="button-add-another-intern"
              >
                Add Another Intern
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Name</label>
                <Input placeholder="Intern's full name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} data-testid="input-invite-name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
                <Input type="email" placeholder="intern@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} data-testid="input-invite-email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Password</label>
                <Input type="password" placeholder="At least 6 characters" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} data-testid="input-invite-password" />
              </div>
              <Button onClick={() => inviteMutation.mutate()} disabled={!inviteName.trim() || !inviteEmail.trim() || invitePassword.length < 6 || inviteMutation.isPending} className="w-full bg-[#6D5EF5] hover:bg-[#5142D6] text-white" data-testid="button-send-invite">
                {inviteMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>) : "Create Account"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md" data-testid="modal-assign">
          <DialogHeader>
            <DialogTitle>Assign Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Intern</label>
              <select value={assignInternId} onChange={(e) => setAssignInternId(e.target.value)} className="w-full rounded-md border border-input bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary" data-testid="select-assign-intern">
                <option value="">Select an intern...</option>
                {(interns as any[]).filter((intern: any) => !intern.deactivatedAt).map((intern: any) => (<option key={intern.id} value={intern.id}>{intern.name} ({intern.email})</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Project Title</label>
              <Input placeholder="e.g., Customer Portal Redesign" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} data-testid="input-assign-title" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Project Idea</label>
              <Textarea placeholder="Brief description of the project..." value={assignIdea} onChange={(e) => setAssignIdea(e.target.value)} rows={3} data-testid="input-assign-idea" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Minimum Total Hours</label>
              <Input type="number" min="1" placeholder="e.g., 160" value={assignMinHours} onChange={(e) => setAssignMinHours(e.target.value)} data-testid="input-assign-hours" />
            </div>
            <Button onClick={handleAssignProject} disabled={!assignInternId || !assignTitle.trim() || !assignIdea.trim() || !assignMinHours || assignProjectMutation.isPending} className="w-full bg-[#6D5EF5] hover:bg-[#5142D6] text-white" data-testid="button-assign-project">
              {assignProjectMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Assigning...</>) : "Assign Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmState} onOpenChange={(open) => { if (!open) setConfirmState(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-600/90 text-white"
              onClick={() => { confirmState?.onConfirm(); setConfirmState(null); }}
            >
              {confirmState?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!deleteInternTarget} onOpenChange={(open) => { if (!open) setDeleteInternTarget(null); }}>
        <DialogContent className="max-w-sm" data-testid="modal-delete-intern">
          <DialogHeader>
            <DialogTitle>Delete {deleteInternTarget?.name} permanently?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60">
            This permanently deletes their account and every task, log, and message tied to it. This cannot be undone.
          </p>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Type <span className="font-semibold text-white">{deleteInternTarget?.name}</span> to confirm
            </label>
            <Input value={deleteInternTyped} onChange={(e) => setDeleteInternTyped(e.target.value)} data-testid="input-delete-intern-confirm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteInternTarget(null)}>Cancel</Button>
            <Button
              disabled={deleteInternTyped !== deleteInternTarget?.name || deleteInternMutation.isPending}
              className="bg-red-600 hover:bg-red-600/90 text-white"
              onClick={() => { if (deleteInternTarget) deleteInternMutation.mutate(deleteInternTarget.id); setDeleteInternTarget(null); }}
              data-testid="button-confirm-delete-intern"
            >
              {deleteInternMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
