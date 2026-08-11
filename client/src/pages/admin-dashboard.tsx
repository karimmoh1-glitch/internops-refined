import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserPlus, Briefcase, AlertCircle, ChevronDown, ChevronRight,
  Loader2, X, Copy, Clock, MessageSquare, CheckCircle2, Pencil, Trash2,
  Target, BarChart3, Filter
} from "lucide-react";
import { AdminDashboardSkeleton } from "@/components/dashboard-skeleton";
import SearchFilterBar from "@/components/search-filter-bar";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import CommandPalette, { useAdminCommands } from "@/components/command-palette";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ProjectStatusPieChart, CompletionRateBarChart, WeeklyActivityLineChart, HoursComparisonChart } from "@/components/analytics-charts";
import GitHubPanel, { GitHubTokenSettings, GitHubRepoInput } from "@/components/github-panel";
import ApplicationsPanel from "@/components/applications-panel";

interface AdminDashboardProps {
  user: { id: string; name: string; role: string; companyId: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  assigned: "bg-gray-100 text-gray-700 border-gray-200",
  planning: "bg-blue-50 text-blue-700 border-blue-200",
  submitted: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
};

function statusBadge(status: string) {
  const cls = STATUS_COLORS[status] || STATUS_COLORS.assigned;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm" data-testid={`plan-review-${project.id}`}>
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900" data-testid={`text-review-title-${project.id}`}>{project.title}</h3>
          {statusBadge(version.status)}
        </div>
        <div className="flex items-center gap-2 mb-1" data-testid={`text-review-intern-${project.id}`}>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 rounded-full text-sm font-semibold border border-blue-200">
            <Users className="w-3.5 h-3.5" /> {project.internName}
          </span>
          <span className="text-sm text-gray-400">{project.internEmail}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Version {version.versionNumber} · {content.numberOfWeeks} weeks · {content.totalPlannedHours}h planned · {content.hoursPerDay}h/day, {content.daysPerWeek} days/week
        </p>
      </div>

      <div className="p-5 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Weekly Plan</h4>
        {weeks.map((week: any) => {
          const key = `${version.id}-w${week.weekNumber}`;
          const isOpen = expandedWeeks[key];
          return (
            <div key={key} className="border border-gray-100 rounded-lg">
              <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors" onClick={() => onToggleWeek(key)} data-testid={`button-toggle-week-${version.id}-${week.weekNumber}`}>
                <span className="text-sm font-medium text-gray-800">Week {week.weekNumber}: {week.milestone}</span>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 text-sm text-gray-600">
                  <p><span className="font-medium text-gray-700">Hours:</span> {week.hours}h</p>
                  <p><span className="font-medium text-gray-700">Success Criteria:</span> {week.successCriteria}</p>
                  <div>
                    <span className="font-medium text-gray-700">Deliverables:</span>
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
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <MessageSquare className="w-4 h-4" /> Comments
          </h4>
          <div className="space-y-2">
            {comments.map((c: any) => (
              <div key={c.id} className="bg-gray-50 rounded p-2 text-sm" data-testid={`comment-${c.id}`}>
                <p className="text-gray-800">{c.content}</p>
                <p className="text-gray-400 text-xs mt-1">{formatLogDate(c.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-5 border-t border-gray-100 space-y-3">
        <Textarea placeholder="Add a comment (required for revision request)..." value={comment} onChange={(e) => onCommentChange(e.target.value)} className="border-gray-300 text-sm" rows={3} data-testid={`input-review-comment-${project.id}`} />
        <div className="flex items-center gap-2">
          <Button onClick={onApprove} disabled={isApproving} size="lg" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 shadow-sm hover:shadow-md transition-all" data-testid={`button-approve-${project.id}`}>
            {isApproving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
            Approve Plan
          </Button>
          <Button onClick={onRequestRevision} disabled={isRequestingRevision} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" data-testid={`button-request-revision-${project.id}`}>
            {isRequestingRevision ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Request Revision
          </Button>
          <Button onClick={onAddComment} variant="outline" className="border-gray-300 text-gray-600 hover:bg-gray-50 ml-auto" data-testid={`button-add-comment-${project.id}`}>
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm" data-testid={`project-detail-${project.id}`}>
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900 truncate" data-testid={`text-detail-title-${project.id}`}>{project.title}</h4>
              {statusBadge(project.status)}
              {approvedVersion && <span className="text-xs text-gray-400">v{approvedVersion.versionNumber}</span>}
            </div>
            <p className="text-sm text-gray-500 truncate">{project.idea}</p>
            {content.totalPlannedHours && (
              <p className="text-xs text-gray-400 mt-1">
                {content.totalPlannedHours}h planned · {content.hoursPerDay}h/day · {content.daysPerWeek} days/week · {content.numberOfWeeks} weeks
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-3 shrink-0">
            <button onClick={() => { setEditTitle(project.title); setEditIdea(project.idea); setEditMinHours(String(project.minimumTotalHours || "")); setEditGithubUrl(project.githubRepoUrl || ""); setShowEditModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" data-testid={`button-edit-project-${project.id}`} title="Edit project">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" data-testid={`button-delete-project-${project.id}`} title="Delete project">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {project.status === "active" && subtaskCompletion.total > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> Subtask Progress
              </span>
              <span className="text-xs text-gray-500">{subtaskCompletion.completed}/{subtaskCompletion.total} tasks ({subtaskCompletion.pct}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${subtaskCompletion.pct >= 100 ? "bg-green-500" : subtaskCompletion.pct > 50 ? "bg-blue-500" : subtaskCompletion.pct > 0 ? "bg-amber-500" : "bg-gray-200"}`} style={{ width: `${Math.max(subtaskCompletion.pct, 1)}%` }} data-testid={`progress-subtask-${project.id}`} />
            </div>
          </div>
        )}
      </div>

      {project.status === "active" && planWeeks.length > 0 && (
        <div className="p-4 space-y-2" data-testid={`execution-tracking-${project.id}`}>
          <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
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
              <div key={key} className={`border rounded-lg transition-all ${isOpen ? "border-indigo-200 bg-indigo-50/20" : "border-gray-100"}`}>
                <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors rounded-lg" onClick={() => toggleWeek(key)} data-testid={`button-expand-week-${project.id}-${week.weekNumber}`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-indigo-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    <span className="text-sm font-medium text-gray-800">W{week.weekNumber}: {week.milestone}</span>
                  </div>
                  <div className="flex items-center gap-3 ml-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${weekPct >= 100 ? "bg-green-500" : weekPct > 0 ? "bg-blue-500" : "bg-gray-200"}`} style={{ width: `${Math.max(weekPct, 3)}%` }} />
                      </div>
                      <span className="text-[11px] text-gray-400 w-8">{weekPct}%</span>
                    </div>
                    <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[11px]">{logs.length} log{logs.length !== 1 ? "s" : ""}</Badge>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 border-t border-gray-100">
                    <div className="pt-2 mb-2 flex items-center gap-4 text-xs text-gray-400">
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
                          <div key={dIdx} className={`border rounded-lg transition-all ${isSubtaskOpen ? "border-indigo-200" : "border-gray-100"}`} data-testid={`subtask-${project.id}-${week.weekNumber}-${dIdx}`}>
                            <button onClick={() => toggleWeek(subtaskKey)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {hasLogs ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />}
                                <span className="text-sm text-gray-700">{deliverable}</span>
                              </div>
                              <span className="text-xs text-gray-400 ml-2">{subtaskLogs.length} log{subtaskLogs.length !== 1 ? "s" : ""}</span>
                            </button>
                            {isSubtaskOpen && subtaskLogs.length > 0 && (
                              <div className="px-3 pb-3 space-y-1.5">
                                {subtaskLogs.map((log: any) => {
                                  const commentsForLog = commentsByLogId[log.id] || [];
                                  const commentValue = logCommentInputs[log.id] || "";
                                  return (
                                    <div key={log.id} className="space-y-1">
                                      <div className="bg-gray-50 rounded-lg p-3 text-sm" data-testid={`log-entry-${log.id}`}>
                                        <p className="text-gray-800 whitespace-pre-wrap" data-testid={`text-log-${log.id}`}>{log.logText}</p>
                                        <p className="text-gray-400 text-xs mt-1" data-testid={`text-log-date-${log.id}`}>
                                          {log.dayNumber ? `Day ${log.dayNumber} · ` : ""}{formatLogDate(log.createdAt)}
                                        </p>
                                      </div>
                                      {commentsForLog.length > 0 && (
                                        <div className="ml-4 space-y-1">
                                          {commentsForLog.map((c: any) => (
                                            <div key={c.id} className="bg-blue-50 rounded px-3 py-1.5 text-xs" data-testid={`log-comment-${c.id}`}>
                                              <p className="text-blue-800">{c.content}</p>
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
                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
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
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-1.5">General Logs</p>
                          {generalLogs.map((log: any) => {
                            const commentsForLog = commentsByLogId[log.id] || [];
                            const commentValue = logCommentInputs[log.id] || "";
                            return (
                              <div key={log.id} className="space-y-1 mb-1.5">
                                <div className="bg-gray-50 rounded-lg p-3 text-sm" data-testid={`log-entry-${log.id}`}>
                                  <p className="text-gray-800 whitespace-pre-wrap">{log.logText}</p>
                                  <p className="text-gray-400 text-xs mt-1">{formatLogDate(log.createdAt)}</p>
                                </div>
                                {commentsForLog.length > 0 && commentsForLog.map((c: any) => (
                                  <div key={c.id} className="ml-4 bg-blue-50 rounded px-3 py-1.5 text-xs">
                                    <p className="text-blue-800">{c.content}</p>
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
          <h5 className="text-sm font-semibold text-gray-700 mb-2">Plan Overview</h5>
          {planWeeks.map((week: any) => {
            const key = `plan-${project.id}-w${week.weekNumber}`;
            const isOpen = expandedWeeks[key];
            return (
              <div key={key} className="border border-gray-100 rounded-lg">
                <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50" onClick={() => toggleWeek(key)} data-testid={`button-plan-week-${project.id}-${week.weekNumber}`}>
                  <span className="text-sm font-medium text-gray-800">Week {week.weekNumber}: {week.milestone}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-1 text-sm text-gray-600">
                    <p><span className="font-medium text-gray-700">Hours:</span> {week.hours}h</p>
                    <p><span className="font-medium text-gray-700">Success Criteria:</span> {week.successCriteria}</p>
                    <div>
                      <span className="font-medium text-gray-700">Deliverables:</span>
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
        <div className="p-4 border-t border-gray-100" data-testid={`plan-comments-section-${project.id}`}>
          <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" /> Plan Comments
          </h5>
          {planComments.length > 0 && (
            <div className="space-y-2 mb-3">
              {planComments.map((c: any) => (
                <div key={c.id} className="bg-blue-50 rounded-lg px-3 py-2 text-sm" data-testid={`plan-comment-${c.id}`}>
                  <p className="text-gray-800">{c.content}</p>
                  <p className="text-gray-400 text-xs mt-1">{formatLogDate(c.createdAt)}</p>
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

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }} data-testid={`modal-edit-project-${project.id}`}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Project</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="border-gray-300" data-testid={`input-edit-title-${project.id}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Idea</label>
                <Textarea value={editIdea} onChange={(e) => setEditIdea(e.target.value)} className="border-gray-300" rows={3} data-testid={`input-edit-idea-${project.id}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Total Hours</label>
                <Input type="number" min="1" value={editMinHours} onChange={(e) => setEditMinHours(e.target.value)} className="border-gray-300" data-testid={`input-edit-hours-${project.id}`} />
              </div>
              <GitHubRepoInput value={editGithubUrl} onChange={setEditGithubUrl} />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1" data-testid={`button-cancel-edit-${project.id}`}>Cancel</Button>
                <Button onClick={() => editProjectMutation.mutate()} disabled={!editTitle.trim() || !editIdea.trim() || !editMinHours || editProjectMutation.isPending} className="flex-1 bg-[#EF7878] hover:bg-[#e05555] text-white" data-testid={`button-save-edit-${project.id}`}>
                  {editProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }} data-testid={`modal-delete-project-${project.id}`}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-600" /></div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Project</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete <span className="font-semibold">"{project.title}"</span>? All plans, logs, and comments will be permanently removed.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1" data-testid={`button-cancel-delete-${project.id}`}>Cancel</Button>
                <Button onClick={() => deleteProjectMutation.mutate()} disabled={deleteProjectMutation.isPending} className="flex-1 bg-red-600 hover:bg-red-700 text-white" data-testid={`button-confirm-delete-${project.id}`}>
                  {deleteProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPlanReview, setShowPlanReview] = useState(false);
  const [expandedIntern, setExpandedIntern] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [copiedLink, setCopiedLink] = useState("");
  const [assignInternId, setAssignInternId] = useState("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignIdea, setAssignIdea] = useState("");
  const [assignMinHours, setAssignMinHours] = useState("");
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const internOverviewRef = useRef<HTMLDivElement>(null);

  const { data: dashboard, isLoading } = useQuery<any>({ queryKey: ["/api/dashboard"] });
  const { data: interns = [] } = useQuery<any[]>({ queryKey: ["/api/interns"] });
  const { data: analytics } = useQuery<any>({ queryKey: ["/api/analytics/admin"] });
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    if (isLoading || !dashboard) return;
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const projectId = params.get("projectId");
    let handled = false;

    if (view === "review") {
      setShowPlanReview(true);
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
    mutationFn: async () => { const res = await apiRequest("POST", "/api/invitations", { name: inviteName, email: inviteEmail }); return res.json(); },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      const link = data.inviteLink;
      setCopiedLink(link);
      toast({ title: "Invitation sent!", description: "Invite link is ready to copy." });
      setInviteName(""); setInviteEmail("");
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6" data-testid="header-section">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="text-company-name">{company?.name || "Company"}</h1>
              <p className="text-gray-500 text-sm mt-1" data-testid="text-dashboard-title">Manager Dashboard</p>
            </div>
            <div className="flex items-center flex-wrap gap-3">
              <Button onClick={() => setShowInviteModal(true)} className="bg-[#EF7878] hover:bg-[#e05555] text-white" data-testid="button-open-invite">
                <UserPlus className="w-4 h-4 mr-2" />Invite Intern
              </Button>
              <Button onClick={() => setShowAssignModal(true)} variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50" data-testid="button-open-assign">
                <Briefcase className="w-4 h-4 mr-2" />Assign Project
              </Button>
              <GitHubTokenSettings companyId={user.companyId || ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => { setFilter(filter === "interns" ? null : "interns"); }} className={`text-left rounded-lg p-4 border transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${filter === "interns" ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200" : "bg-gray-50 border-gray-100 hover:border-blue-200"}`} data-testid="stat-total-interns">
              <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-blue-600" /><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Interns</span></div>
              <p className="text-2xl font-bold text-gray-900">{allDashboardInterns.length}</p>
            </button>
            <button onClick={() => { setFilter(filter === "projects" ? null : "projects"); }} className={`text-left rounded-lg p-4 border transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${filter === "projects" ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200" : "bg-gray-50 border-gray-100 hover:border-indigo-200"}`} data-testid="stat-total-projects">
              <div className="flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 text-indigo-600" /><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projects</span></div>
              <p className="text-2xl font-bold text-gray-900">{totalProjects}</p>
            </button>
            <button onClick={() => { setFilter(filter === "active" ? null : "active"); }} className={`text-left rounded-lg p-4 border transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${filter === "active" ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200" : "bg-gray-50 border-gray-100 hover:border-emerald-200"}`} data-testid="stat-active-projects">
              <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</span></div>
              <p className="text-2xl font-bold text-gray-900">{activeProjects}</p>
            </button>
            <button onClick={() => { const newFilter = filter === "review" ? null : "review"; setFilter(newFilter); if (newFilter === "review") setShowPlanReview(true); }} className={`text-left rounded-lg p-4 border transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${filter === "review" ? "bg-amber-50 border-amber-300 ring-2 ring-amber-200" : "bg-gray-50 border-gray-100 hover:border-amber-200"}`} data-testid="stat-pending-review">
              <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-600" /><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Review</span></div>
              <p className="text-2xl font-bold text-gray-900">{pendingReview}</p>
            </button>
          </div>
          {filter && (
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 text-sm flex items-center gap-1.5" data-testid="badge-active-filter">
                <Filter className="w-3 h-3" />
                Filtering: {filter === "interns" ? "All Interns" : filter === "projects" ? "All Projects" : filter === "active" ? "Active Projects" : "Pending Review"}
              </Badge>
              <button onClick={() => { setFilter(null); }} className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red-50 transition-colors" data-testid="button-clear-filter">
                <X className="w-3 h-3" /> Clear filter
              </button>
            </div>
          )}
        </div>

        {pendingReview > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="alert-pending-review">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-amber-800 font-medium">{pendingReview} plan{pendingReview > 1 ? "s" : ""} awaiting your review</span>
            </div>
          </div>
        )}

        {submittedProjects.length > 0 && (
          <div className="space-y-4" data-testid="plan-review-panel">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-review-header">
                  <AlertCircle className="w-5 h-5 text-amber-600" /> Review Now
                </h2>
                <p className="text-sm text-gray-500 mt-1" data-testid="text-review-count">
                  {submittedProjects.length} plan{submittedProjects.length !== 1 ? "s" : ""} need{submittedProjects.length === 1 ? "s" : ""} your review
                </p>
              </div>
            </div>
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm" data-testid="analytics-section">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors rounded-xl"
              data-testid="button-toggle-analytics"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
              </div>
              {showAnalytics ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>
            {showAnalytics && (
              <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="analytics-charts">
                <ProjectStatusPieChart data={analytics.statusCounts || []} />
                <CompletionRateBarChart data={analytics.completionRates || []} />
                <WeeklyActivityLineChart data={analytics.logActivity || []} />
                <HoursComparisonChart data={analytics.hoursComparison || []} />
              </div>
            )}
          </div>
        )}

        <ApplicationsPanel companyId={user.companyId} />

        <div ref={internOverviewRef} data-testid="intern-overview-section">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-600" />Intern Overview
          </h2>

          {allDashboardInterns.length > 0 && (
            <SearchFilterBar
              placeholder="Search interns, projects..."
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              filterOptions={[
                { value: "active", label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                { value: "review", label: "Pending Review", color: "bg-amber-50 text-amber-700 border-amber-200" },
              ]}
              activeFilter={filter}
              onFilterChange={setFilter}
              resultCount={filteredInterns.length}
            />
          )}

          {filteredInterns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center" data-testid="text-no-interns">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              {searchQuery || filter ? (
                <>
                  <p className="text-gray-500 text-lg mb-1">No matching results</p>
                  <p className="text-gray-400 text-sm mb-3">Try adjusting your search or filters.</p>
                  <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setFilter(null); }}>Clear filters</Button>
                </>
              ) : (
                <>
                  <p className="text-gray-500 text-lg mb-1">No interns yet</p>
                  <p className="text-gray-400 text-sm mb-3">Invite your first intern to get started.</p>
                  <Button onClick={() => setShowInviteModal(true)} className="bg-[#EF7878] hover:bg-[#e05555] text-white">
                    <UserPlus className="w-4 h-4 mr-2" />Invite Intern
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
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer" onClick={() => setExpandedIntern(isExpanded ? null : intern.id)}>
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 font-semibold" data-testid={`text-intern-name-${intern.id}`}>{intern.name}</p>
                            <p className="text-gray-500 text-sm" data-testid={`text-intern-email-${intern.id}`}>{intern.email}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {projects.length === 0 ? (
                              <span className="text-gray-400 text-sm">No projects</span>
                            ) : (
                              <>
                                {projects.map((project: any) => (
                                  <div key={project.id} className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-700 font-medium truncate max-w-[200px]" data-testid={`text-project-title-${project.id}`}>{project.title}</span>
                                    {statusBadge(project.status)}
                                  </div>
                                ))}
                                {overallCompletion.total > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-20 bg-gray-200 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full transition-all ${overallCompletion.pct >= 100 ? "bg-green-500" : overallCompletion.pct > 50 ? "bg-blue-500" : overallCompletion.pct > 0 ? "bg-amber-500" : "bg-gray-200"}`} style={{ width: `${Math.max(overallCompletion.pct, 3)}%` }} />
                                    </div>
                                    <span className="text-xs text-gray-400">{overallCompletion.pct}%</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <div>{isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}</div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 space-y-3" data-testid={`expanded-intern-${intern.id}`}>
                        {projects.length > 1 && (
                          <div className="flex justify-end px-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                              onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ALL ${projects.length} projects for ${intern.name}? This cannot be undone.`)) { deleteAllProjectsMutation.mutate(intern.id); } }}
                              disabled={deleteAllProjectsMutation.isPending}
                              data-testid={`button-delete-all-projects-${intern.id}`}
                            >
                              {deleteAllProjectsMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                              Delete All Projects
                            </Button>
                          </div>
                        )}
                        {projects.length === 0 ? (
                          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                            <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No projects assigned yet</p>
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
                  <span className="text-xs text-gray-400">
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
                        className={`h-7 w-7 text-xs p-0 ${p === pagination.page ? "bg-[#EF7878] text-white" : ""}`}
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

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="modal-invite">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Invite Intern</h3>
              <button onClick={() => { setShowInviteModal(false); setCopiedLink(""); }} className="text-gray-400 hover:text-gray-600" data-testid="button-close-invite"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input placeholder="Intern's full name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="border-gray-300" data-testid="input-invite-name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input type="email" placeholder="intern@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="border-gray-300" data-testid="input-invite-email" />
              </div>
              <Button onClick={() => inviteMutation.mutate()} disabled={!inviteName.trim() || !inviteEmail.trim() || inviteMutation.isPending} className="w-full bg-[#EF7878] hover:bg-[#e05555] text-white" data-testid="button-send-invite">
                {inviteMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>) : "Send Invitation"}
              </Button>
              {copiedLink && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3" data-testid="invite-link-display">
                  <p className="text-green-800 text-sm font-medium mb-2">Invite link created!</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={copiedLink} className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1 text-gray-700" data-testid="text-invite-link" />
                    <Button size="sm" variant="outline" onClick={() => copyLink(copiedLink)} className="border-green-300 text-green-700 hover:bg-green-100" data-testid="button-copy-link">
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="modal-assign">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Assign Project</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-close-assign"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intern</label>
                <select value={assignInternId} onChange={(e) => setAssignInternId(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="select-assign-intern">
                  <option value="">Select an intern...</option>
                  {(interns as any[]).map((intern: any) => (<option key={intern.id} value={intern.id}>{intern.name} ({intern.email})</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                <Input placeholder="e.g., Customer Portal Redesign" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} className="border-gray-300" data-testid="input-assign-title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Idea</label>
                <Textarea placeholder="Brief description of the project..." value={assignIdea} onChange={(e) => setAssignIdea(e.target.value)} className="border-gray-300" rows={3} data-testid="input-assign-idea" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Total Hours</label>
                <Input type="number" min="1" placeholder="e.g., 160" value={assignMinHours} onChange={(e) => setAssignMinHours(e.target.value)} className="border-gray-300" data-testid="input-assign-hours" />
              </div>
              <Button onClick={handleAssignProject} disabled={!assignInternId || !assignTitle.trim() || !assignIdea.trim() || !assignMinHours || assignProjectMutation.isPending} className="w-full bg-[#EF7878] hover:bg-[#e05555] text-white" data-testid="button-assign-project">
                {assignProjectMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Assigning...</>) : "Assign Project"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
